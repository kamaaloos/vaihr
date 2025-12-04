-- Fix Online Status (Correct Version)
-- This script updates the user_status table where is_online column exists

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users
FROM user_status;

-- Step 2: Show current user status records
SELECT 
    'Current User Status' as info,
    id,
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
FROM user_status 
ORDER BY updated_at DESC;

-- Step 3: Update all users to be online
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW();

-- Step 4: Check if update worked
SELECT 
    'After Update' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 5: Show updated user status records
SELECT 
    'Updated User Status' as info,
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
    us.is_online,
    us.platform,
    us.last_seen,
    us.updated_at
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.updated_at DESC; 