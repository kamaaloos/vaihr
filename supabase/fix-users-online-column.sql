-- Fix Users Online Column
-- This script will sync the users.online column with user_status.is_online

-- Step 1: Check current state of both tables
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online_true,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_online_false,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online_true,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_online_false
FROM users LIMIT 1;

-- Step 2: Show current users table status
SELECT 
    'Users Table Status' as info,
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

-- Step 3: Update users.online to match user_status.is_online
UPDATE users 
SET online = us.is_online
FROM user_status us
WHERE users.id = us.user_id::text;

-- Step 4: Check if update worked
SELECT 
    'After Update' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online_true,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_online_false,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online_true,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_online_false
FROM users LIMIT 1;

-- Step 5: Show updated users table status
SELECT 
    'Updated Users Table Status' as info,
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

-- Step 6: Verify both tables are in sync
SELECT 
    'Sync Verification' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text; 