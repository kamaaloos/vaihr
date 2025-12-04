-- Fix Online Status Sync
-- This script will sync users.online with user_status.is_online and fix admin status

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline
FROM users LIMIT 1;

-- Step 2: Show current status for all users
SELECT 
    'Current Status' as info,
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

-- Step 3: First, set admin users to offline (they're not connected)
UPDATE users 
SET online = false
WHERE role = 'admin' OR email LIKE '%admin%';

-- Step 4: Update users.online to match user_status.is_online for non-admin users
UPDATE users 
SET online = us.is_online
FROM user_status us
WHERE users.id = us.user_id::text
    AND (users.role != 'admin' AND users.email NOT LIKE '%admin%');

-- Step 5: Update user_status to set admin users to offline
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW() - INTERVAL '1 hour',
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND (u.role = 'admin' OR u.email LIKE '%admin%');

-- Step 6: Verify the fix
SELECT 
    'After Fix' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text;

-- Step 7: Show final status
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

-- Step 8: Summary
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline;

-- Step 9: Show only connected users
SELECT 
    'Connected Users Only' as info,
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
WHERE u.online = true AND us.is_online = true
ORDER BY us.last_seen DESC; 