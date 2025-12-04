-- Direct Fix Online Status
-- Run this in the Supabase SQL Editor to directly fix online status

-- Step 1: Check users table structure
SELECT 
    'Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Step 2: Check current users data
SELECT 
    'Current Users Data' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Step 3: Check if is_online column exists and its values
SELECT 
    'Online Status Check' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users;

-- Step 4: Try direct update with explicit column reference
UPDATE users 
SET 
    "is_online" = true,
    "updated_at" = NOW()
WHERE "is_online" = false OR "is_online" IS NULL;

-- Step 5: Check if update worked
SELECT 
    'After Update Check' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users;

-- Step 6: Show updated users
SELECT 
    'Updated Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
ORDER BY updated_at DESC;

-- Step 7: Check user_status table
SELECT 
    'User Status Table' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_records,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_records
FROM user_status;

-- Step 8: Clear user_status table
DELETE FROM user_status;

-- Step 9: Insert fresh user_status records
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
SELECT 
    id::uuid,
    is_online,
    'mobile',
    NOW(),
    NOW(),
    NOW()
FROM users;

-- Step 10: Final verification
SELECT 
    'Final Verification' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 11: Show final online users
SELECT 
    'Final Online Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
WHERE is_online = true
ORDER BY updated_at DESC;

-- Step 12: Show final user_status records
SELECT 
    'Final User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at
FROM user_status 
ORDER BY created_at DESC; 