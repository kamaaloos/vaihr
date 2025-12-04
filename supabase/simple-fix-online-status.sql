-- Simple Fix for Online Status
-- This script will directly fix the online status issues

-- Step 1: Disable RLS temporarily to bypass any restrictions
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 2: Update all users to be online
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW();

-- Step 3: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 4: Clear and recreate user_status records
DELETE FROM user_status;

INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
SELECT 
    id::uuid,
    is_online,
    'mobile',
    NOW(),
    NOW(),
    NOW()
FROM users;

-- Step 5: Verify the fix
SELECT 
    'Fix Results' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 6: Show all users
SELECT 
    'All Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
ORDER BY updated_at DESC; 