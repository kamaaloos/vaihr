-- Remove Redundant Online Status Columns
-- This script will safely remove is_online and online_status columns

-- Step 1: Verify current state before removal
SELECT 
    'Before Removal' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false
FROM users;

-- Step 2: Show current values for all users
SELECT 
    'Current Values Before Removal' as info,
    id,
    name,
    email,
    role,
    online as main_online_column,
    is_online as redundant_column1,
    online_status as redundant_column2
FROM users 
ORDER BY name;

-- Step 3: Remove the redundant is_online column
ALTER TABLE users DROP COLUMN IF EXISTS is_online;

-- Step 4: Remove the redundant online_status column
ALTER TABLE users DROP COLUMN IF EXISTS online_status;

-- Step 5: Verify the columns were removed
SELECT 
    'After Removal - Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY ordinal_position;

-- Step 6: Verify data integrity after removal
SELECT 
    'After Removal - Data Verification' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false
FROM users;

-- Step 7: Show final clean status
SELECT 
    'Final Clean Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online_status,
    us.is_online as user_status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 8: Show only connected users
SELECT 
    'Connected Users Only' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true
ORDER BY us.last_seen DESC;

-- Step 9: Final summary
SELECT 
    'Cleanup Complete' as info,
    'Successfully removed redundant columns:' as action,
    '1. is_online (redundant boolean column)' as removed1,
    '2. online_status (redundant text column)' as removed2,
    'Kept: online (main boolean column)' as kept,
    'Total users: ' || (SELECT COUNT(*) FROM users) as total_users,
    'Online users: ' || (SELECT COUNT(*) FROM users WHERE online = true) as online_users,
    'Offline users: ' || (SELECT COUNT(*) FROM users WHERE online = false) as offline_users; 