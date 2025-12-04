-- Show True Connection Status
-- This script will show exactly which users are truly connected

-- Step 1: Show detailed status for all users
SELECT 
    'Detailed User Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 <= 5 THEN 'TRULY CONNECTED'
        WHEN EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 <= 10 THEN 'RECENTLY ACTIVE'
        ELSE 'STALE - SHOULD BE OFFLINE'
    END as connection_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true OR us.is_online = true
ORDER BY us.last_seen DESC;

-- Step 2: Show only the truly connected user
SELECT 
    'Truly Connected User' as info,
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
    AND EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 <= 5
ORDER BY us.last_seen DESC;

-- Step 3: Show the user with stale online status
SELECT 
    'User with Stale Online Status' as info,
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
WHERE (u.online = true OR us.is_online = true)
    AND EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 5
ORDER BY us.last_seen ASC;

-- Step 4: Clean up stale online status (set to offline)
UPDATE users 
SET online = false
FROM user_status us
WHERE users.id = us.user_id::text
    AND us.last_seen IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 5;

UPDATE user_status 
SET 
    is_online = false,
    updated_at = NOW()
WHERE last_seen IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - last_seen))/60 > 5;

-- Step 5: Show final clean status
SELECT 
    'Final Clean Status' as info,
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

-- Step 6: Final verification - should show only 1 truly connected user
SELECT 
    'Final Verification' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true AND EXTRACT(EPOCH FROM (NOW() - last_seen))/60 <= 5) as truly_connected;

-- Step 7: Show the single connected user
SELECT 
    'Single Connected User' as info,
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
ORDER BY us.last_seen DESC; 