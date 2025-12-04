-- Debug User Status Table Directly
-- This script will help us understand what's actually in the user_status table

-- Step 1: Check if user_status table exists and has data
SELECT 
    'User Status Table Check' as info,
    COUNT(*) as total_records
FROM user_status;

-- Step 2: Show all records in user_status table
SELECT 
    'All User Status Records' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
FROM user_status
ORDER BY last_seen DESC;

-- Step 3: Check specific admin users
SELECT 
    'Specific Admin Check' as info,
    us.user_id,
    us.is_online,
    us.platform,
    us.last_seen,
    u.name,
    u.role
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
WHERE us.user_id IN (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
    '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e'::uuid
)
ORDER BY us.last_seen DESC;

-- Step 4: Test the exact query that ChatListScreen uses
SELECT 
    'ChatListScreen Query Test' as info,
    us.user_id,
    us.is_online,
    us.last_seen
FROM user_status us
WHERE us.user_id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid;

SELECT 
    'ChatListScreen Query Test 2' as info,
    us.user_id,
    us.is_online,
    us.last_seen
FROM user_status us
WHERE us.user_id = '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e'::uuid;

-- Step 5: Check if there are any UUID format issues
SELECT 
    'UUID Format Test' as info,
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid as test_uuid,
    '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e'::uuid as test_uuid2;

-- Step 6: Check if the admin users exist in users table
SELECT 
    'Admin Users Check' as info,
    id,
    name,
    role,
    online
FROM users 
WHERE id IN (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
    '1d5bc85c-54b9-4c53-93eb-b9bbc51eb84e'
); 