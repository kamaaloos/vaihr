-- Disable Triggers and Fix Online Status
-- Run this in the Supabase SQL Editor to disable triggers and fix online status

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users,
    (SELECT COUNT(*) FROM user_status) as total_status_records;

-- Step 2: Disable ALL triggers on users table
ALTER TABLE users DISABLE TRIGGER ALL;

-- Step 3: Disable ALL triggers on user_status table
ALTER TABLE user_status DISABLE TRIGGER ALL;

-- Step 4: Drop all problematic triggers and functions
DROP TRIGGER IF EXISTS sync_online_status_trigger ON users;
DROP TRIGGER IF EXISTS job_notification_trigger ON jobs;
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP TRIGGER IF EXISTS user_status_update_trigger ON user_status;
DROP TRIGGER IF EXISTS user_status_last_seen_trigger ON user_status;
DROP TRIGGER IF EXISTS batch_status_update_trigger ON user_status;
DROP FUNCTION IF EXISTS sync_online_status();
DROP FUNCTION IF EXISTS notify_on_job_changes();
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();
DROP FUNCTION IF EXISTS update_user_status_last_seen();
DROP FUNCTION IF EXISTS handle_status_updates();
DROP FUNCTION IF EXISTS handle_batch_status_updates();

-- Step 5: Clear user_status table completely
DELETE FROM user_status;

-- Step 6: Check user_status is empty
SELECT 
    'After Clear' as info,
    (SELECT COUNT(*) FROM user_status) as remaining_status_records;

-- Step 7: Update all users to be online (no triggers will fire)
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 8: Check users update result
SELECT 
    'Users Update Result' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users;

-- Step 9: Show all users
SELECT 
    'All Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Step 10: Insert user_status records for existing users only
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

-- Step 11: Final status check
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 12: Show online users
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

-- Step 13: Show user_status records
SELECT 
    'User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at
FROM user_status 
ORDER BY created_at DESC;

-- Step 14: Re-enable triggers (optional - comment out if you want to keep them disabled)
-- ALTER TABLE users ENABLE TRIGGER ALL;
-- ALTER TABLE user_status ENABLE TRIGGER ALL; 