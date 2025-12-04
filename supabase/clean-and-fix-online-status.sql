-- Clean and Fix Online Status
-- Run this in the Supabase SQL Editor to clean up and fix online status

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users,
    (SELECT COUNT(*) FROM user_status) as total_status_records;

-- Step 2: Clean up orphaned user_status records (with proper type casting)
DELETE FROM user_status 
WHERE user_id::text NOT IN (SELECT id::text FROM users);

-- Step 3: Check orphaned records cleanup
SELECT 
    'After Cleanup' as info,
    (SELECT COUNT(*) FROM user_status) as remaining_status_records;

-- Step 4: Drop the problematic trigger first
DROP TRIGGER IF EXISTS sync_online_status_trigger ON users;
DROP FUNCTION IF EXISTS sync_online_status();

-- Step 5: Directly update all users to be online
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 6: Check the users update result
SELECT 
    'Users Update Result' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users;

-- Step 7: Update user_status table to match (only for existing users)
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
FROM users
ON CONFLICT (user_id) DO UPDATE
SET
    is_online = EXCLUDED.is_online,
    last_seen = NOW(),
    updated_at = NOW();

-- Step 8: Final status check
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 9: Show online users
SELECT 
    'Online Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
WHERE is_online = true
ORDER BY updated_at DESC;

-- Step 10: Show user_status records
SELECT 
    'User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at
FROM user_status 
ORDER BY created_at DESC; 