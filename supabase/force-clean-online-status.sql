-- Force Clean and Fix Online Status
-- Run this in the Supabase SQL Editor to completely reset and fix online status

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users,
    (SELECT COUNT(*) FROM user_status) as total_status_records;

-- Step 2: Show problematic user_status records
SELECT 
    'Problematic User Status Records' as info,
    user_id,
    is_online,
    platform,
    created_at
FROM user_status 
WHERE user_id::text NOT IN (SELECT id::text FROM users);

-- Step 3: Completely clear user_status table
TRUNCATE TABLE user_status RESTART IDENTITY CASCADE;

-- Step 4: Check user_status is empty
SELECT 
    'After Truncate' as info,
    (SELECT COUNT(*) FROM user_status) as remaining_status_records;

-- Step 5: Drop any problematic triggers
DROP TRIGGER IF EXISTS sync_online_status_trigger ON users;
DROP TRIGGER IF EXISTS job_notification_trigger ON jobs;
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS sync_online_status();
DROP FUNCTION IF EXISTS notify_on_job_changes();
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Step 6: Directly update all users to be online
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 7: Check the users update result
SELECT 
    'Users Update Result' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users;

-- Step 8: Rebuild user_status table with only existing users
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

-- Step 9: Final status check
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 10: Show online users
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

-- Step 11: Show user_status records
SELECT 
    'User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at
FROM user_status 
ORDER BY created_at DESC;

-- Step 12: Verify no orphaned records
SELECT 
    'Verification' as info,
    (SELECT COUNT(*) FROM user_status us 
     LEFT JOIN users u ON us.user_id::text = u.id::text 
     WHERE u.id IS NULL) as orphaned_records; 