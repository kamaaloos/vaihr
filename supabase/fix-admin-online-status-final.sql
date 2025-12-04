-- Fix Admin Online Status - Final Solution
-- This script will ensure the admin shows as online in the driver chat screen

-- Step 1: Check current admin status
SELECT 
    'Current Admin Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Step 2: Set admin to online in user_status table
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
    true,
    'web',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW();

-- Step 3: Set admin to online in users table (if online column exists)
UPDATE users 
SET online = true
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Step 4: Verify the fix
SELECT 
    'After Fix - Admin Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Step 5: Test the exact query that ChatListScreen uses
SELECT 
    'ChatListScreen Query Test' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'; 