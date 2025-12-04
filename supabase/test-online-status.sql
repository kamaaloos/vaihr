-- Test Online Status System
-- Run this after applying the fixes to verify everything is working

-- Step 1: Check current database state
SELECT 
    'Database State Check' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM user_status) as total_user_status_records;

-- Step 2: Check for any constraint issues
SELECT 
    'Constraint Check' as info,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'user_status';

-- Step 3: Check for duplicate user_id entries
SELECT 
    'Duplicate Check' as info,
    COUNT(*) as duplicate_count
FROM (
    SELECT user_id, COUNT(*) as count
    FROM user_status 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
) duplicates;

-- Step 4: Check for orphaned records
SELECT 
    'Orphaned Records Check' as info,
    COUNT(*) as orphaned_count
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
WHERE u.id IS NULL;

-- Step 5: Show current online status for all users
SELECT 
    'Current Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    us.created_at,
    us.updated_at
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 6: Test manual online status update (replace with actual user ID)
-- Uncomment and replace 'YOUR_USER_ID_HERE' with an actual user ID to test
/*
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid;

-- Check if the trigger worked
SELECT 
    'After Manual Update Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'YOUR_USER_ID_HERE';
*/

-- Step 7: Instructions for app testing
SELECT 
    'App Testing Instructions' as info,
    '1. Try logging in with the app' as step1,
    '2. Check console logs for OnlineStatusManager messages' as step2,
    '3. Verify user goes online in both tables' as step3,
    '4. Test app background/foreground' as step4,
    '5. Test logout functionality' as step5;

-- Step 8: Show triggers
SELECT 
    'Active Triggers' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%online%' OR trigger_name LIKE '%user_status%'; 