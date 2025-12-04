-- Check RLS and Fix Online Status
-- Run this in the Supabase SQL Editor to check RLS and fix online status

-- Step 1: Check if RLS is enabled on users table
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users';

-- Step 2: Check RLS policies on users table
SELECT 
    'RLS Policies' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users';

-- Step 3: Check current user context
SELECT 
    'Current Context' as info,
    current_user as current_user,
    session_user as session_user,
    current_setting('role') as current_role;

-- Step 4: Check if we can read from users table
SELECT 
    'Can Read Users' as info,
    COUNT(*) as user_count
FROM users;

-- Step 5: Try to update a single user first
UPDATE users 
SET 
    is_online = true,
    updated_at = NOW()
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid
LIMIT 1;

-- Step 6: Check if single update worked
SELECT 
    'Single Update Test' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid;

-- Step 7: Try using service role context
DO $$
DECLARE
    update_count INTEGER;
BEGIN
    -- Set role to service_role
    SET ROLE service_role;
    
    RAISE NOTICE 'Attempting update as service_role...';
    
    UPDATE users 
    SET 
        is_online = true,
        updated_at = NOW()
    WHERE is_online = false OR is_online IS NULL;
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % users as service_role', update_count;
    
    -- Reset role
    SET ROLE postgres;
END $$;

-- Step 8: Check if service_role update worked
SELECT 
    'After Service Role Update' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online IS NULL THEN 1 END) as null_online_users;

-- Step 9: Show all users after update
SELECT 
    'All Users After Update' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
ORDER BY updated_at DESC;

-- Step 10: Update user_status table to match
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

-- Step 11: Final verification
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 12: Show final online users
SELECT 
    'Final Online Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    updated_at
FROM users 
WHERE is_online = true
ORDER BY updated_at DESC; 