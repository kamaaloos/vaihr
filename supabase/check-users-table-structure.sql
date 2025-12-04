-- Check Users Table Structure
-- Run this first to see what we're working with

-- 1. Check table structure
SELECT 
    'Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if RLS is enabled
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users' 
    AND schemaname = 'public';

-- 3. Check existing policies
SELECT 
    'Existing Policies' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
    AND schemaname = 'public';

-- 4. Check table permissions
SELECT 
    'Table Permissions' as info,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'users' 
    AND table_schema = 'public';

