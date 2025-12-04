-- Check Column Names
-- This script will show us exactly what columns exist

-- Check users table columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check user_status table columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_status' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Try to select from users table to see what we can access
SELECT 
    'Users Table Sample' as info,
    *
FROM users 
LIMIT 1;

-- Try to select from user_status table to see what we can access
SELECT 
    'User Status Table Sample' as info,
    *
FROM user_status 
LIMIT 1; 