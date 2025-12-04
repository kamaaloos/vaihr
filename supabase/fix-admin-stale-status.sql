-- Fix Admin Stale Online Status
-- This script will fix the Admin user's stale online status

-- Step 1: Show current status
SELECT 
    'Current Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true OR us.is_online = true
ORDER BY us.last_seen DESC;

-- Step 2: Set Admin user to offline (since they're not connected)
UPDATE users 
SET online = false
WHERE email = 'admin@admin.com' OR name = 'Admin';

-- Step 3: Update Admin user's status record
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW() - INTERVAL '1 hour',
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND (u.email = 'admin@admin.com' OR u.name = 'Admin');

-- Step 4: Also set any other admin users to offline
UPDATE users 
SET online = false
WHERE role = 'admin' OR email LIKE '%admin%';

UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW() - INTERVAL '1 hour',
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND (u.role = 'admin' OR u.email LIKE '%admin%');

-- Step 5: Show status after Admin fix
SELECT 
    'After Admin Fix' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true OR us.is_online = true
ORDER BY us.last_seen DESC;

-- Step 6: Show only truly connected users (should be only Hasan Kamaal)
SELECT 
    'Truly Connected Users Only' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true 
    AND us.is_online = true
    AND u.role != 'admin'
    AND u.email NOT LIKE '%admin%'
ORDER BY us.last_seen DESC;

-- Step 7: Final verification
SELECT 
    'Final Verification' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline,
    (SELECT COUNT(*) FROM users u 
     LEFT JOIN user_status us ON u.id = us.user_id::text 
     WHERE u.online = true AND us.is_online = true 
     AND u.role != 'admin' AND u.email NOT LIKE '%admin%') as connected_drivers;

-- Step 8: Show the single connected driver
SELECT 
    'Connected Driver' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true 
    AND us.is_online = true
    AND u.role = 'driver'
ORDER BY us.last_seen DESC; 