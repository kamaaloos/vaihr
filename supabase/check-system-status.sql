-- Check system status to diagnose notification issues
-- Run this in the Supabase SQL Editor

-- 1. Check if users table has the required columns
SELECT 
    'Users Table Columns' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('role', 'online_status')
ORDER BY column_name;

-- 2. Check current users and their roles
SELECT 
    'Current Users' as check_type,
    id,
    email,
    name,
    role,
    online_status,
    created_at
FROM users
ORDER BY created_at DESC;

-- 3. Count users by role
SELECT 
    'Users by Role' as check_type,
    role,
    COUNT(*) as count
FROM users
GROUP BY role;

-- 4. Check if trigger function exists
SELECT 
    'Trigger Function' as check_type,
    proname as function_name,
    proowner::regrole as owner,
    prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'notify_on_job_changes';

-- 5. Check if trigger exists
SELECT 
    'Trigger' as check_type,
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgtype,
    tgenabled
FROM pg_trigger 
WHERE tgname = 'job_notification_trigger';

-- 6. Test direct notification insert (bypass trigger)
DO $$
DECLARE
    test_id UUID;
BEGIN
    RAISE NOTICE '=== TESTING DIRECT NOTIFICATION INSERT ===';
    
    INSERT INTO notifications (
        user_id, title, message, type, data, created_at
    ) VALUES (
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        'Test Notification',
        'Testing direct insert',
        'test',
        '{"test": true}'::jsonb,
        NOW()
    ) RETURNING id INTO test_id;
    
    RAISE NOTICE '✅ Direct notification insert successful: %', test_id;
    
    -- Clean up
    DELETE FROM notifications WHERE id = test_id;
    RAISE NOTICE '🧹 Test notification cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Direct notification insert failed: %', SQLERRM;
END $$;

-- 7. Show current notification count
SELECT 
    'Current Notifications' as check_type,
    COUNT(*) as count
FROM notifications; 