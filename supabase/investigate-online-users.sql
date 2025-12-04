-- Investigate Online Users
-- This script will help identify which users are actually connected vs showing as online

-- Step 1: Show all users with their online status and last seen times
SELECT 
    'All Users Status' as info,
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
ORDER BY us.last_seen DESC;

-- Step 2: Show only users marked as online
SELECT 
    'Users Marked as Online' as info,
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
        WHEN EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 5 THEN 'POSSIBLY OFFLINE'
        ELSE 'LIKELY ONLINE'
    END as connection_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true OR us.is_online = true
ORDER BY us.last_seen DESC;

-- Step 3: Check for users with old last_seen times (likely not connected)
SELECT 
    'Users with Old Last Seen' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 10 THEN 'SHOULD BE OFFLINE'
        WHEN EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 5 THEN 'POSSIBLY OFFLINE'
        ELSE 'LIKELY ONLINE'
    END as recommendation
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE us.last_seen IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 5
ORDER BY us.last_seen ASC;

-- Step 4: Set users with old last_seen times to offline
UPDATE users 
SET online = false
FROM user_status us
WHERE users.id = us.user_id::text
    AND us.last_seen IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 > 10;

-- Step 5: Update user_status for users with old last_seen times
UPDATE user_status 
SET 
    is_online = false,
    updated_at = NOW()
WHERE last_seen IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - last_seen))/60 > 10;

-- Step 6: Show final status after cleanup
SELECT 
    'Final Status After Cleanup' as info,
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

-- Step 7: Show only truly connected users
SELECT 
    'Truly Connected Users' as info,
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

-- Step 8: Final summary
SELECT 
    'Final Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true AND EXTRACT(EPOCH FROM (NOW() - last_seen))/60 <= 5) as truly_connected; 