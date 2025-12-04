-- Consolidate Online Status Columns
-- This script will clean up the redundant online status columns

-- Step 1: Check current state before consolidation
SELECT 
    'Before Consolidation' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN is_online = true THEN 1 END) as is_online_true,
    COUNT(CASE WHEN online_status = 'online' THEN 1 END) as online_status_online,
    COUNT(CASE WHEN online_status = 'offline' THEN 1 END) as online_status_offline
FROM users;

-- Step 2: Show current values for all users
SELECT 
    'Current Values' as info,
    id,
    name,
    email,
    role,
    online,
    is_online,
    online_status,
    CASE 
        WHEN online = true OR is_online = true OR online_status = 'online' THEN 'SHOULD BE ONLINE'
        ELSE 'SHOULD BE OFFLINE'
    END as recommended_status
FROM users 
ORDER BY name;

-- Step 3: Create a new consolidated online status column
-- First, let's determine the correct online status based on user_status table
UPDATE users 
SET online = COALESCE(us.is_online, false)
FROM user_status us
WHERE users.id = us.user_id::text;

-- Step 4: Set admin users to offline (they're not connected)
UPDATE users 
SET online = false
WHERE email IN ('admin@admin.com', 'admin2@admin.com')
   OR name IN ('Admin', 'Admin User');

-- Step 5: Verify the consolidation
SELECT 
    'After Consolidation' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false
FROM users;

-- Step 6: Show final status
SELECT 
    'Final Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as consolidated_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 7: Show only connected users
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

-- Step 8: Summary
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline;

-- Step 9: Recommendation for cleanup
SELECT 
    'Cleanup Recommendation' as info,
    'The following columns should be removed:' as recommendation,
    '1. is_online (redundant with online)' as column1,
    '2. online_status (text column with inconsistent values)' as column2,
    'Keep only: online (boolean column)' as keep_column; 