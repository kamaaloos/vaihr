-- Diagnose Driver Status Issues
-- This script will help identify why drivers aren't showing online indicators

-- Step 1: Check what's in the user_status table
SELECT 
    'All User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
FROM user_status 
ORDER BY last_seen DESC;

-- Step 2: Check if drivers have status records
SELECT 
    'Drivers with Status Records' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_is_online,
    us.last_seen,
    CASE 
        WHEN us.user_id IS NOT NULL THEN 'HAS STATUS RECORD'
        ELSE 'NO STATUS RECORD'
    END as status_record_exists
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'driver'
ORDER BY us.last_seen DESC;

-- Step 3: Check which drivers should be online
SELECT 
    'Online Status Summary' as info,
    COUNT(*) as total_drivers,
    COUNT(CASE WHEN us.is_online = true THEN 1 END) as status_online,
    COUNT(CASE WHEN u.online = true THEN 1 END) as users_online,
    COUNT(CASE WHEN us.is_online = true OR u.online = true THEN 1 END) as should_be_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'driver';

-- Step 4: Create status records for drivers that don't have them
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
    u.online,  -- Use the online status from users table
    'web',
    COALESCE(u.updated_at, NOW()),
    NOW(),
    NOW()
FROM users u
WHERE u.role = 'driver'
    AND u.id NOT IN (SELECT user_id::text FROM user_status)
ON CONFLICT (user_id) DO NOTHING;

-- Step 5: Set Hasan Kamaal to online for testing
UPDATE user_status 
SET 
    is_online = true,
    platform = 'android',
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (
    SELECT id::uuid FROM users 
    WHERE role = 'driver' 
    AND email = 'kamaaloos@gmail.com'
    LIMIT 1
);

-- Step 6: Final check
SELECT 
    'Final Status Check' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_is_online,
    us.last_seen,
    CASE 
        WHEN us.is_online = true THEN 'ONLINE'
        WHEN u.online = true THEN 'ONLINE (users table)'
        ELSE 'OFFLINE'
    END as final_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'driver'
ORDER BY us.is_online DESC, us.last_seen DESC; 