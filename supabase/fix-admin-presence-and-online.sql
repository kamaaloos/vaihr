-- Fix Admin Presence and Online Status
-- This script will ensure the admin user shows as online in the chat system

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
    us.last_seen,
    us.updated_at
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

-- Step 7: Check if there are any other admin users that need fixing
SELECT 
    'Other Admin Users' as info,
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
WHERE u.role = 'admin' AND u.id != 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'
ORDER BY us.last_seen DESC;

-- Step 8: Set all admin users to online
UPDATE user_status 
SET 
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND u.role = 'admin';

-- Step 9: Update users table for all admins
UPDATE users 
SET online = true
WHERE role = 'admin';

-- Step 10: Final verification
SELECT 
    'Final Status - All Admins' as info,
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
WHERE u.role = 'admin'
ORDER BY u.name; 