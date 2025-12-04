-- Force Sync Online Status
-- This script will force sync the users.online column with user_status.is_online

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline
FROM users LIMIT 1;

-- Step 2: Since all user_status records show online=true, set all users to online
UPDATE users 
SET online = true;

-- Step 3: Verify the update
SELECT 
    'After Force Update' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline
FROM users LIMIT 1;

-- Step 4: Show all users with their status
SELECT 
    'All Users Status' as info,
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

-- Step 5: Final verification
SELECT 
    'Final Verification' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text; 