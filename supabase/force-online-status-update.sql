-- Force Online Status Update
-- This script will force update all users to online status

-- Step 1: Check current state before update
SELECT 
    'Before Update' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 2: Disable RLS temporarily
ALTER TABLE user_status DISABLE ROW LEVEL SECURITY;

-- Step 3: Force update all records to online
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE is_online = false OR is_online IS NULL;

-- Step 4: Re-enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Step 5: Check if update worked
SELECT 
    'After Force Update' as info,
    COUNT(*) as total_status_records,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users
FROM user_status;

-- Step 6: Show all user status records
SELECT 
    'All User Status Records' as info,
    id,
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
FROM user_status 
ORDER BY updated_at DESC;

-- Step 7: Show users with their online status
SELECT 
    'All Users with Online Status' as info,
    u.id,
    u.name,
    u.email,
    us.is_online,
    us.platform,
    us.last_seen,
    us.updated_at
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.updated_at DESC;

-- Step 8: If some users don't have status records, create them
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

-- Step 9: Final verification
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM user_status) as total_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_users; 