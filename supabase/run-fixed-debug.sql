-- Run Fixed Debug Script
-- This script will test the fixed online status updates

-- Step 1: Check current state
SELECT 'Current State' as step, COUNT(*) as total_users FROM users;

-- Step 2: Check specific user details with correct column name
SELECT 
    'User Details' as step,
    id,
    name,
    email,
    role,
    online,
    updated_at,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Step 3: Test simple update
UPDATE users 
SET updated_at = NOW() 
WHERE id = (SELECT id FROM users LIMIT 1);

-- Step 4: Check if the update worked
SELECT 
    'After Simple Update' as step,
    id,
    name,
    updated_at
FROM users 
ORDER BY updated_at DESC 
LIMIT 3;

-- Step 5: Try updating online status with correct column name
UPDATE users 
SET 
    online = true,
    updated_at = NOW()
WHERE id::text IN (
    SELECT id::text FROM users 
    WHERE online = false OR online IS NULL
    LIMIT 3
);

-- Step 6: Check if the online status update worked
SELECT 
    'After Online Update' as step,
    id,
    name,
    email,
    online,
    updated_at
FROM users 
ORDER BY updated_at DESC;

-- Step 7: Final status check
SELECT 
    'Final Check' as step,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN online IS NULL THEN 1 END) as null_online_users;

-- Step 8: Show all users with their current status
SELECT 
    'All Users Final State' as step,
    id,
    name,
    email,
    role,
    online,
    updated_at
FROM users 
ORDER BY updated_at DESC; 