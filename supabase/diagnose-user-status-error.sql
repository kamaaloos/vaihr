-- Diagnose user_status table access issue
-- This will help understand why the trigger can't access the user_status table

-- 1. Check if user_status table exists and its schema
SELECT 
  'Table Existence' as info,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'user_status';

-- 2. Check table structure
SELECT 
  'Table Structure' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- 3. Check trigger function and its permissions
SELECT 
  'Trigger Function' as info,
  routine_name,
  routine_schema,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_name = 'ensure_driver_status';

-- 4. Check trigger details
SELECT 
  'Trigger Details' as info,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'ensure_driver_status_trigger';

-- 5. Check current user and schema
SELECT 
  'Current Context' as info,
  current_user as current_user,
  current_schema as current_schema,
  session_user as session_user;

-- 6. Check if the trigger function can access the table
-- This will show the actual error when the function tries to access user_status
SELECT 
  'Testing Trigger Function' as info,
  'The following query will test if the trigger function can access user_status table' as note;

-- 7. Check RLS policies on user_status table
SELECT 
  'RLS Policies' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_status';

-- 8. Check if there are any grants on the user_status table
SELECT 
  'Table Grants' as info,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'user_status'; 