-- Create Admin User Status Records
-- This script will ensure that user_status records exist for admin users

-- Step 1: Check current status
SELECT 
    'Current Status' as info,
    u.id,
    u.name,
    u.role,
    CASE 
        WHEN us.user_id IS NOT NULL THEN 'HAS STATUS RECORD'
        ELSE 'NO STATUS RECORD'
    END as status_record_exists,
    us.is_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 2: Create user_status records for admin users that don't have them
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
    true, -- Set them as online
    'web',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM user_status us WHERE us.user_id = u.id::uuid
);

-- Step 3: Update existing admin user_status records to be online
UPDATE user_status 
SET 
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id IN (
    SELECT id::uuid FROM users WHERE role = 'admin'
);

-- Step 4: Verify the fix
SELECT 
    'After Fix' as info,
    u.id,
    u.name,
    u.role,
    us.is_online,
    us.last_seen,
    us.platform
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY u.name;

-- Step 5: Test the exact query that ChatListScreen uses
SELECT 
    'ChatListScreen Test Query' as info,
    us.user_id,
    us.is_online,
    us.last_seen
FROM user_status us
WHERE us.user_id IN (
    SELECT id::uuid FROM users WHERE role = 'admin'
)
ORDER BY us.last_seen DESC; 