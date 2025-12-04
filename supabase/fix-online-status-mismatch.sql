-- Fix Online Status Mismatch
-- This script will identify and fix mismatched online status

-- Step 1: Show the mismatched records
SELECT 
    'Mismatched Records' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online != us.is_online OR us.is_online IS NULL
ORDER BY u.online DESC;

-- Step 2: Check which table has the correct data
-- Let's assume user_status.is_online is more accurate since it tracks real-time
-- Update users.online to match user_status.is_online
UPDATE users 
SET online = COALESCE(us.is_online, false)
FROM user_status us
WHERE users.id = us.user_id::text;

-- Step 3: For users without status records, set them to offline
UPDATE users 
SET online = false
WHERE id::text NOT IN (
    SELECT user_id::text FROM user_status
);

-- Step 4: Verify the fix
SELECT 
    'After Fix' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text;

-- Step 5: Show final status
SELECT 
    'Final Status' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 6: Summary
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline; 