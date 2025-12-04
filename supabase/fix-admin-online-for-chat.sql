-- Fix Admin Online Status for Chat Screen
-- This script will set the admin user to online so it shows in the driver's chat list

-- Step 1: Check current admin status
SELECT 
    'Before Fix - Admin Status' as info,
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

-- Step 2: Create or update admin's user_status record to be online
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

-- Step 3: Update users table to match (if online column exists)
UPDATE users 
SET online = true
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Step 4: Check if fix worked
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

-- Step 5: Test the query that ChatListScreen uses
SELECT 
    'ChatListScreen Query Test' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Step 6: Show all users that would appear in chat list
SELECT 
    'All Users for Chat List' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online,
    u.role
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.is_online DESC, u.name; 