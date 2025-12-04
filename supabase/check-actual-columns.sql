-- Check Actual Columns in Users Table
-- This script will show us exactly what columns exist in the users table

-- Step 1: Check all columns in users table
SELECT 
    'Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check specifically for online-related columns
SELECT 
    'Online-Related Columns' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY ordinal_position;

-- Step 3: Try to select all columns from users table
SELECT 
    'Sample Users Data' as info,
    *
FROM users 
LIMIT 1;

-- Step 4: Check user_status table structure
SELECT 
    'User Status Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_status' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 5: Show sample user_status data
SELECT 
    'Sample User Status Data' as info,
    *
FROM user_status 
LIMIT 1; 