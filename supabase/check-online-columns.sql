-- Check Online Status Columns
-- This script will show all online status columns in the users table

-- Step 1: Check table structure for online-related columns
SELECT 
    'Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY ordinal_position;

-- Step 2: Show current values for all online columns
SELECT 
    'Current Online Status Values' as info,
    id,
    name,
    email,
    role,
    online,
    is_online,
    online_status,
    created_at,
    updated_at
FROM users 
ORDER BY online DESC, is_online DESC;

-- Step 3: Check for inconsistencies (with proper type casting)
SELECT 
    'Inconsistencies' as info,
    id,
    name,
    email,
    online,
    is_online,
    online_status,
    CASE 
        WHEN online::text = is_online::text AND online::text = online_status THEN 'All Match'
        WHEN online::text = is_online::text THEN 'online = is_online'
        WHEN online::text = online_status THEN 'online = online_status'
        WHEN is_online::text = online_status THEN 'is_online = online_status'
        ELSE 'All Different'
    END as status
FROM users 
WHERE NOT (online::text = is_online::text AND online::text = online_status)
ORDER BY name;

-- Step 4: Count different values (with proper type handling)
SELECT 
    'Value Counts' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN is_online = true THEN 1 END) as is_online_true,
    COUNT(CASE WHEN online_status = 'true' OR online_status = 'online' THEN 1 END) as online_status_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false,
    COUNT(CASE WHEN is_online = false THEN 1 END) as is_online_false,
    COUNT(CASE WHEN online_status = 'false' OR online_status = 'offline' THEN 1 END) as online_status_false
FROM users;

-- Step 5: Show user_status table for comparison
SELECT 
    'User Status Table' as info,
    us.user_id,
    u.name,
    u.email,
    us.is_online as status_is_online,
    u.online as users_online,
    u.is_online as users_is_online,
    u.online_status as users_online_status
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
ORDER BY us.is_online DESC;

-- Step 6: Show data types for each column
SELECT 
    'Column Data Types' as info,
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'boolean' THEN 'Boolean (true/false)'
        WHEN data_type = 'text' THEN 'Text (string)'
        WHEN data_type = 'character varying' THEN 'Varchar (string)'
        ELSE data_type
    END as type_description
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY ordinal_position;

-- Step 7: Show all possible values in online_status column
SELECT 
    'Online Status Values' as info,
    online_status,
    COUNT(*) as count
FROM users 
WHERE online_status IS NOT NULL
GROUP BY online_status
ORDER BY count DESC; 