-- Fix Online Status Using Only User Status Table
-- This script avoids issues with missing columns in users table

-- Step 1: Check current state of user_status table
SELECT 
    'Current User Status State' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users
FROM user_status;

-- Step 2: Show current user status records
SELECT 
    'Current User Status Records' as info,
    id,
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
FROM user_status 
ORDER BY updated_at DESC;

-- Step 3: Update all users to be online in user_status table
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 4: Check if update worked
SELECT 
    'After Update' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 5: Show updated user status records
SELECT 
    'Updated User Status Records' as info,
    id,
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
FROM user_status 
ORDER BY updated_at DESC;

-- Step 6: Join with users table to show user details (with proper type casting)
SELECT 
    'Users with Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.is_online,
    us.platform,
    us.last_seen,
    us.updated_at
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.updated_at DESC;

-- Step 7: Create user_status records for users who don't have them
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
    true,
    'mobile',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.id::text NOT IN (
    SELECT user_id::text FROM user_status
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 8: Final status check
SELECT 
    'Final Status' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 9: Show all users with their online status
SELECT 
    'All Users with Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.is_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.is_online DESC, us.last_seen DESC; 