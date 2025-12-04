-- Fix Admin Offline Status
-- This script will directly set admin users to offline

-- Step 1: Show current admin users
SELECT 
    'Current Admin Users' as info,
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
WHERE u.email LIKE '%admin%' OR u.name LIKE '%Admin%'
ORDER BY u.online DESC;

-- Step 2: Set specific admin users to offline in users table
UPDATE users 
SET online = false
WHERE email IN ('admin@admin.com', 'admin2@admin.com')
   OR name IN ('Admin', 'Admin User');

-- Step 3: Set admin users to offline in user_status table
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW() - INTERVAL '1 hour',
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND (u.email IN ('admin@admin.com', 'admin2@admin.com') 
         OR u.name IN ('Admin', 'Admin User'));

-- Step 4: Verify admin users are now offline
SELECT 
    'Admin Users After Fix' as info,
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
WHERE u.email LIKE '%admin%' OR u.name LIKE '%Admin%'
ORDER BY u.online DESC;

-- Step 5: Show all users status
SELECT 
    'All Users Status' as info,
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

-- Step 6: Show only actually connected users
SELECT 
    'Actually Connected Users' as info,
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

-- Step 7: Summary
SELECT 
    'Final Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline; 