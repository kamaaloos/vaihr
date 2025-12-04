-- Check Online Column Constraints and Dependencies (Fixed)
-- This script will check for any constraints or references before removing columns

-- Step 1: Check for foreign key constraints referencing these columns
SELECT 
    'Foreign Key Constraints' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'users'
    AND (kcu.column_name LIKE '%online%' OR kcu.column_name = 'online');

-- Step 2: Check for triggers on the users table
SELECT 
    'Triggers on Users Table' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
    AND event_object_schema = 'public';

-- Step 3: Check for views that reference these columns
SELECT 
    'Views Referencing Online Columns' as info,
    v.table_name as view_name,
    v.view_definition
FROM information_schema.views v
WHERE v.table_schema = 'public'
    AND (v.view_definition LIKE '%users.online%' 
         OR v.view_definition LIKE '%users.is_online%' 
         OR v.view_definition LIKE '%users.online_status%');

-- Step 4: Check for RLS policies that reference these columns
SELECT 
    'RLS Policies on Users Table' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
    AND (qual LIKE '%online%' OR with_check LIKE '%online%');

-- Step 5: Check for indexes on these columns
SELECT 
    'Indexes on Online Columns' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users'
    AND (indexdef LIKE '%online%' OR indexdef LIKE '%is_online%' OR indexdef LIKE '%online_status%');

-- Step 6: Check for any other tables that might reference these columns
SELECT 
    'Other Tables with Online Columns' as info,
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
    AND table_name != 'users'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY table_name, column_name;

-- Step 7: Check for any stored procedures or functions (simplified)
SELECT 
    'Functions/Procedures' as info,
    p.proname as function_name,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND (p.prosrc LIKE '%users.online%' 
         OR p.prosrc LIKE '%users.is_online%' 
         OR p.prosrc LIKE '%users.online_status%');

-- Step 8: Check for any application code references
SELECT 
    'Potential Code References' as info,
    'Check your application code for:' as recommendation,
    '1. SELECT queries using is_online or online_status' as check1,
    '2. UPDATE queries setting is_online or online_status' as check2,
    '3. INSERT queries including is_online or online_status' as check3,
    '4. Frontend code reading these columns' as check4;

-- Step 9: Summary of what to check
SELECT 
    'Summary' as info,
    'If any of the above queries return results, you need to:' as action,
    '1. Update foreign key constraints' as step1,
    '2. Modify triggers' as step2,
    '3. Update views' as step3,
    '4. Modify RLS policies' as step4,
    '5. Update application code' as step5,
    '6. Then safely remove redundant columns' as step6; 