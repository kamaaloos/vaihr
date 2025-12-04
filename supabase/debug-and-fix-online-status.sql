-- Debug and Fix Online Status Issues
-- This script will help identify why online status updates aren't working

-- Step 1: Check current state
SELECT 'Current State' as step, COUNT(*) as total_users FROM users;

-- Step 2: Check specific user details
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

-- Step 3: Check if we can actually update (test with a simple update)
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

-- Step 5: Try updating online status with explicit casting
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

-- Step 7: Check RLS policies more thoroughly
SELECT 
    'RLS Policy Details' as step,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users';

-- Step 8: Check if there are any triggers that might be interfering
SELECT 
    'Triggers' as step,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users';

-- Step 9: Try updating as postgres superuser
DO $$
DECLARE
    user_record RECORD;
    update_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting manual update loop...';
    
    FOR user_record IN SELECT id FROM users WHERE online = false OR online IS NULL LIMIT 5
    LOOP
        BEGIN
            UPDATE users 
            SET 
                online = true,
                updated_at = NOW()
            WHERE id = user_record.id;
            
            update_count := update_count + 1;
            RAISE NOTICE 'Updated user %', user_record.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to update user %: %', user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Updated % users', update_count;
END $$;

-- Step 10: Check final state
SELECT 
    'Final Check' as step,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN online IS NULL THEN 1 END) as null_online_users;

-- Step 11: Show all users with their current status
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

-- Step 12: If still not working, try disabling RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 13: Update all users to online
UPDATE users 
SET 
    online = true,
    updated_at = NOW();

-- Step 14: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 15: Final verification
SELECT 
    'After RLS Disable/Enable' as step,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_users,
    COUNT(CASE WHEN online = false THEN 1 END) as offline_users;

-- Step 16: Update user_status table to match
DELETE FROM user_status;

INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
SELECT 
    id::uuid,
    online,
    'mobile',
    NOW(),
    NOW(),
    NOW()
FROM users;

-- Step 17: Final status check
SELECT 
    'Complete Status' as step,
    (SELECT COUNT(*) FROM users WHERE online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records; 