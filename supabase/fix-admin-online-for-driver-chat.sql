-- Fix Admin Online Status for Driver Chat Screen
-- This script will ensure admin users show as online in the driver's chat list

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
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 2: Create or update admin user_status records to be online
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
    'web',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.role = 'admin'
ON CONFLICT (user_id) DO UPDATE
SET
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW();

-- Step 3: Update users table to match (if online column exists)
UPDATE users 
SET online = true
WHERE role = 'admin';

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
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 5: Test the exact query that ChatListScreen uses
SELECT 
    'ChatListScreen Query Test' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 6: Show all users that would appear in driver's chat list
SELECT 
    'All Users for Driver Chat List' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online,
    u.role
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.is_online DESC, u.name;

-- Step 7: Check if there are any chats between driver and admin
SELECT 
    'Existing Chats' as info,
    c.id,
    c.admin_id,
    c.driver_id,
    admin.name as admin_name,
    driver.name as driver_name,
    c.last_message,
    c.last_message_time
FROM chats c
LEFT JOIN users admin ON c.admin_id = admin.id
LEFT JOIN users driver ON c.driver_id = driver.id
ORDER BY c.last_message_time DESC; 