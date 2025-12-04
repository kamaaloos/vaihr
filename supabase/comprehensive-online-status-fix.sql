-- Comprehensive Online Status Fix
-- This script will check the actual schema and apply the appropriate fix

-- Step 1: Check what columns actually exist in users table
SELECT 
    'Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check what columns exist in user_status table
SELECT 
    'User Status Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_status' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 3: Check current state of user_status table
SELECT 
    'Current User Status State' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users
FROM user_status;

-- Step 4: Show current user status records
SELECT 
    'Current User Status Records' as info,
    id,
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
FROM user_status 
ORDER BY updated_at DESC;

-- Step 5: Update all users to be online in user_status table
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 6: Check if update worked
SELECT 
    'After Update' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 7: Create user_status records for users who don't have them
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
    'mobile',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.id::text NOT IN (
    SELECT user_id::text FROM user_status
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 8: Show all users with their online status
SELECT 
    'All Users with Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.is_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.is_online DESC, us.last_seen DESC;

-- Step 9: Final summary
SELECT 
    'Final Summary' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM user_status) as total_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_users; 