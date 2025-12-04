-- Fix Remaining Admin User
-- This script will fix the "Admin User" that's still showing as offline

-- Step 1: Check the "Admin User" status
SELECT 
    'Admin User Status' as info,
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
WHERE u.name = 'Admin User';

-- Step 2: Create or update Admin User's user_status record to be online
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
WHERE u.name = 'Admin User'
ON CONFLICT (user_id) DO UPDATE
SET
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW();

-- Step 3: Update users table to match
UPDATE users 
SET online = true
WHERE name = 'Admin User';

-- Step 4: Verify the fix
SELECT 
    'After Fix - All Admin Users' as info,
    u.name,
    u.role,
    us.is_online as status_online,
    u.online as users_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 5: Test the exact query that ChatListScreen uses for both admins
SELECT 
    'ChatListScreen Query Test - All Admins' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name; 