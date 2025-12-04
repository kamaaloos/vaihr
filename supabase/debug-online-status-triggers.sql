-- Debug Online Status Triggers
-- This script helps identify why online status is being set to false

-- Step 1: Check if triggers exist and are enabled
SELECT 
    'Trigger Status' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%online%' OR trigger_name LIKE '%user_status%'
ORDER BY trigger_name;

-- Step 2: Check the trigger functions
SELECT 
    'Trigger Functions' as info,
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%online%' OR routine_name LIKE '%user_status%';

-- Step 3: Check current user_status records
SELECT 
    'Current user_status records' as info,
    us.user_id,
    u.name,
    us.is_online,
    us.platform,
    us.last_seen,
    us.created_at,
    us.updated_at
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
ORDER BY us.updated_at DESC;

-- Step 4: Check current users table online status
SELECT 
    'Current users table online status' as info,
    u.id,
    u.name,
    u.online,
    u.email,
    u.role
FROM users u
ORDER BY u.online DESC, u.name;

-- Step 5: Test the trigger manually (replace with actual user ID)
-- Replace '36a28a98-995f-4452-86fa-7d8bcc9ed0f1' with the actual user ID from your logs
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 6: Check if the trigger worked
SELECT 
    'After manual update test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 7: Check RLS policies that might be affecting updates
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
WHERE tablename IN ('users', 'user_status');

-- Step 8: Check if RLS is enabled on tables
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('users', 'user_status');

-- Step 9: Show the actual trigger function code
SELECT 
    'Trigger Function Code' as info,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname LIKE '%online%' OR proname LIKE '%user_status%'; 