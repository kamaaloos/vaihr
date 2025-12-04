-- Check users table structure for notification system
-- Run this in the Supabase SQL Editor

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

-- Check if online_status column exists
SELECT 
    'Online Status Check' as info,
    COUNT(*) as column_exists
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'online_status';

-- Check if role column exists
SELECT 
    'Role Check' as info,
    COUNT(*) as column_exists
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'role';

-- Show current users and their roles
SELECT 
    'Current Users' as info,
    id,
    email,
    role,
    online_status,
    created_at
FROM users
ORDER BY created_at DESC;

-- Count users by role
SELECT 
    'Users by Role' as info,
    role,
    COUNT(*) as count
FROM users
GROUP BY role;

-- Count online drivers
SELECT 
    'Online Drivers' as info,
    COUNT(*) as count
FROM users
WHERE role = 'driver' AND online_status = 'online'; 