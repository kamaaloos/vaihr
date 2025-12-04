-- Check Table Structure
-- This script will show us the actual structure of the tables

-- Check users table structure
SELECT 
    'Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check user_status table structure
SELECT 
    'User Status Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Show sample data from users table
SELECT 
    'Sample Users Data' as info,
    *
FROM users 
LIMIT 3;

-- Show sample data from user_status table
SELECT 
    'Sample User Status Data' as info,
    *
FROM user_status 
LIMIT 3;

-- Check if there are any other tables that might contain online status
SELECT 
    'All Tables' as info,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name; 