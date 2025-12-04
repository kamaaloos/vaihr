-- Fix Real Online Status
-- This script will fix user_status to match the actual online status from users table

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline
FROM users LIMIT 1;

-- Step 2: Show current mismatched records
SELECT 
    'Current Mismatched Records' as info,
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

-- Step 3: Update user_status to match users.online (the real status)
UPDATE user_status 
SET 
    is_online = u.online,
    last_seen = CASE 
        WHEN u.online = true THEN NOW()
        ELSE last_seen
    END,
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id;

-- Step 4: For users without status records, create them with correct online status
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
SELECT 
    u.id::uuid,
    u.online,
    'mobile',
    CASE 
        WHEN u.online = true THEN NOW()
        ELSE NOW() - INTERVAL '1 hour'
    END,
    NOW(),
    NOW()
FROM users u
WHERE u.id::text NOT IN (
    SELECT user_id::text FROM user_status
)
ON CONFLICT (user_id) DO NOTHING;

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
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 7: Summary
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline; 