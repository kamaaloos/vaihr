-- Simple Online Status Fix
-- Run this in the Supabase SQL Editor to directly fix online status

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users;

-- Step 2: Directly update all users to be online
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 3: Check the result
SELECT 
    'After Update' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM users WHERE is_online IS NULL) as null_online_users;

-- Step 4: Show all users and their online status
SELECT 
    'All Users Status' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
ORDER BY updated_at DESC;

-- Step 5: Update user_status table to match
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
SELECT 
    id,
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

-- Step 6: Final status check
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 7: Show online users
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