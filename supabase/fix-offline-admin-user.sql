-- Fix Offline Admin User
-- This script will set the "Admin User" to online so it appears in the driver's chat list

-- Step 1: Check current status of the specific admin
SELECT 
    'Current Admin User Status' as info,
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
WHERE u.id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 2: Set Admin User to online in user_status table
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

-- Step 3: Set Admin User to online in users table (if online column exists)
UPDATE users 
SET online = true
WHERE id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 4: Verify the fix
SELECT 
    'After Fix - Admin User Status' as info,
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
WHERE u.id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e';

-- Step 5: Show all admins that should now appear in driver's chat list
SELECT 
    'All Admins for Driver Chat List' as info,
    u.id,
    u.name,
    u.profile_image,
    us.is_online,
    u.role,
    CASE 
        WHEN us.is_online = true THEN 'SHOULD APPEAR'
        ELSE 'OFFLINE ADMIN'
    END as status_for_driver
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY us.is_online DESC, u.name; 