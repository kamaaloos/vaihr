-- Fix Online Sync Issue
-- This script will fix the synchronization between user_status and users tables

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline
FROM users LIMIT 1;

-- Step 2: Show the mismatch
SELECT 
    'Mismatch Details' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    CASE 
        WHEN u.online != us.is_online THEN 'MISMATCH'
        ELSE 'OK'
    END as status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online != us.is_online OR us.is_online IS NULL
ORDER BY us.last_seen DESC;

-- Step 3: Update users.online to match user_status.is_online
UPDATE users 
SET online = COALESCE(us.is_online, false)
FROM user_status us
WHERE users.id = us.user_id::text;

-- Step 4: For users without status records, set them to offline
UPDATE users 
SET online = false
WHERE id::text NOT IN (
    SELECT user_id::text FROM user_status
);

-- Step 5: Verify the fix
SELECT 
    'After Fix' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text;

-- Step 6: Show final status
SELECT 
    'Final Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 7: Show only connected users
SELECT 
    'Connected Users Only' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true AND us.is_online = true
ORDER BY us.last_seen DESC;

-- Step 8: Check if the trigger is working
SELECT 
    'Trigger Status' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'users'
    AND trigger_name LIKE '%online%';

-- Step 9: Test the trigger by updating a user
-- This will test if the trigger is working properly
UPDATE users 
SET online = online  -- This should trigger the sync
WHERE id = (SELECT id FROM users WHERE online = true LIMIT 1);

-- Step 10: Final verification
SELECT 
    'Final Verification' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline; 