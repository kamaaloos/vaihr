-- Check Authentication Triggers and Functions
-- This script will help identify why login/logout isn't updating online status

-- Step 1: Check all triggers on the users table
SELECT 
    'All Triggers on Users Table' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
    AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 2: Check for authentication-related functions
SELECT 
    'Authentication Functions' as info,
    p.proname as function_name,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND (p.prosrc LIKE '%login%' 
         OR p.prosrc LIKE '%logout%' 
         OR p.prosrc LIKE '%auth%'
         OR p.prosrc LIKE '%online%'
         OR p.prosrc LIKE '%user_status%')
ORDER BY p.proname;

-- Step 3: Check for RLS policies that might affect online status
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
WHERE tablename IN ('users', 'user_status')
    AND (qual LIKE '%online%' OR with_check LIKE '%online%' OR qual LIKE '%auth%' OR with_check LIKE '%auth%');

-- Step 4: Check for any functions that update user_status
SELECT 
    'Functions Updating User Status' as info,
    p.proname as function_name,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosrc LIKE '%user_status%'
ORDER BY p.proname;

-- Step 5: Check for any functions that handle online status
SELECT 
    'Functions Handling Online Status' as info,
    p.proname as function_name,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prosrc LIKE '%online%'
ORDER BY p.proname;

-- Step 6: Check for any auth-related triggers on other tables
SELECT 
    'Auth-Related Triggers on Other Tables' as info,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
    AND (action_statement LIKE '%auth%' 
         OR action_statement LIKE '%login%' 
         OR action_statement LIKE '%logout%'
         OR action_statement LIKE '%online%')
ORDER BY event_object_table, trigger_name;

-- Step 7: Check for any views that might be used for authentication
SELECT 
    'Auth-Related Views' as info,
    v.table_name as view_name,
    v.view_definition
FROM information_schema.views v
WHERE v.table_schema = 'public'
    AND (v.view_definition LIKE '%auth%' 
         OR v.view_definition LIKE '%login%' 
         OR v.view_definition LIKE '%logout%'
         OR v.view_definition LIKE '%online%');

-- Step 8: Summary and recommendations
SELECT 
    'Summary and Recommendations' as info,
    'If no triggers/functions found, you need to:' as action,
    '1. Create a trigger on user_status table for INSERT/UPDATE' as step1,
    '2. Create a function to sync users.online with user_status.is_online' as step2,
    '3. Update your app code to call these functions on login/logout' as step3,
    '4. Or create a trigger that fires when user_status changes' as step4; 