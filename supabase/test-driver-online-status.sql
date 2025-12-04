-- Test Driver Online Status for Admin Home Screen
-- This script helps verify that drivers' online status is properly set up for the admin's driver list

-- Step 1: Check current driver status in users table
SELECT 
    'Drivers in Users Table' as info,
    id,
    name,
    email,
    role,
    online as users_online,
    updated_at as users_updated_at
FROM users 
WHERE role = 'driver'
ORDER BY name;

-- Step 2: Check current driver status in user_status table
SELECT 
    'Drivers in User_Status Table' as info,
    user_id,
    is_online as status_is_online,
    platform,
    last_seen,
    created_at,
    updated_at
FROM user_status 
WHERE user_id IN (
    SELECT id FROM users WHERE role = 'driver'
)
ORDER BY last_seen DESC;

-- Step 3: Join both tables to see the complete picture
SELECT 
    'Combined Driver Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_is_online,
    us.platform,
    us.last_seen,
    CASE 
        WHEN us.is_online = true THEN 'ONLINE (from user_status)'
        WHEN u.online = true THEN 'ONLINE (from users)'
        ELSE 'OFFLINE'
    END as final_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver'
ORDER BY us.last_seen DESC;

-- Step 4: Check which drivers should show as online in the admin list
SELECT 
    'Drivers for Admin List' as info,
    u.id,
    u.name,
    u.email,
    CASE 
        WHEN us.is_online = true THEN true
        WHEN u.online = true THEN true
        ELSE false
    END as should_show_online,
    us.is_online as status_is_online,
    u.online as users_online,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver'
ORDER BY should_show_online DESC, us.last_seen DESC;

-- Step 5: Test setting a driver online manually
UPDATE user_status 
SET 
    is_online = true,
    platform = 'android',
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (
    SELECT id FROM users 
    WHERE role = 'driver' 
    AND email = 'kamaaloos@gmail.com'
    LIMIT 1
);

-- Step 6: Verify the manual update worked
SELECT 
    'After Manual Update' as info,
    u.id,
    u.name,
    u.email,
    us.is_online as status_is_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver' 
    AND u.email = 'kamaaloos@gmail.com';

-- Step 7: Instructions for testing
SELECT 
    'Testing Instructions' as info,
    '1. Check the admin home screen driver list' as step1,
    '2. Look for green online indicators next to driver avatars' as step2,
    '3. Verify that Hasan Kamaal shows as online' as step3,
    '4. Check console logs for "Driver [id] status:" messages' as step4,
    '5. If no indicators show, check the database queries above' as step5; 