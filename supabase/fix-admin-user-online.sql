-- Fix Admin User Online Status
-- This script will ensure the "Admin User" is set to online in the users table

-- Step 1: Check current status of Admin User
SELECT 
    'Current Admin User Status' as info,
    u.id,
    u.name,
    u.role,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 2: Set Admin User to online in users table
UPDATE users 
SET online = true
WHERE id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 3: Ensure Admin User has a user_status record
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e'::uuid,
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

-- Step 4: Verify the fix
SELECT 
    'After Fix - Admin User Status' as info,
    u.id,
    u.name,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 5: Show all admins status
SELECT 
    'All Admins Status' as info,
    u.id,
    u.name,
    u.role,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name; 