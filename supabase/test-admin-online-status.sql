-- Test Admin Online Status for ChatListScreen
-- This script tests the exact queries that ChatListScreen uses

-- Step 1: Test the admin users query
SELECT 
    'Admin Users Query' as info,
    u.id,
    u.name,
    u.profile_image,
    u.role
FROM users u
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 2: Test the user_status query for admins
SELECT 
    'User Status Query for Admins' as info,
    us.user_id,
    us.is_online,
    us.last_seen,
    us.platform
FROM user_status us
WHERE us.user_id IN (
    SELECT id FROM users WHERE role = 'admin'
)
ORDER BY us.last_seen DESC;

-- Step 3: Test the combined query (like ChatListScreen does)
SELECT 
    'Combined Query Test' as info,
    u.id,
    u.name,
    u.profile_image,
    u.role,
    us.is_online,
    us.last_seen,
    CASE 
        WHEN us.is_online = true THEN 'ONLINE'
        WHEN us.is_online = false THEN 'OFFLINE'
        ELSE 'NO STATUS RECORD'
    END as status_description
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY us.is_online DESC, u.name;

-- Step 4: Check if there are any issues with the user_id format
SELECT 
    'User ID Format Check' as info,
    u.id as users_id,
    us.user_id as status_user_id,
    u.id::uuid as users_id_as_uuid,
    CASE 
        WHEN u.id::uuid = us.user_id THEN 'MATCH'
        ELSE 'MISMATCH'
    END as id_match
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'; 