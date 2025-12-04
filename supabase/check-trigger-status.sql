-- Comprehensive trigger and RLS diagnostic script
-- Run this in the Supabase SQL Editor

-- 1. Check if the trigger function exists
SELECT 
    'Trigger Function Status' as check_type,
    proname as function_name,
    proowner::regrole as owner,
    prosecdef as security_definer,
    proacl as permissions
FROM pg_proc 
WHERE proname = 'notify_admin_on_job_status_change';

-- 2. Check if the trigger exists
SELECT 
    'Trigger Status' as check_type,
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgtype,
    tgenabled,
    tgdeferrable,
    tginitdeferred
FROM pg_trigger 
WHERE tgname = 'job_status_notification_trigger';

-- 3. Check RLS policies on notifications table
SELECT 
    'RLS Policies' as check_type,
    policyname,
    tablename,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 4. Check if notifications table has RLS enabled
SELECT 
    'Table RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'notifications';

-- 5. Test direct insert into notifications (bypassing trigger)
DO $$
DECLARE
    test_notification_id UUID;
    insert_success BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== TESTING DIRECT INSERT INTO NOTIFICATIONS ===';
    
    BEGIN
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            data,
            created_at
        ) VALUES (
            'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
            'Direct Insert Test',
            'Testing if RLS allows direct inserts',
            'test',
            '{"test": true}'::jsonb,
            NOW()
        ) RETURNING id INTO test_notification_id;
        
        insert_success := TRUE;
        RAISE NOTICE '✅ Direct insert SUCCESSFUL - RLS policies are working';
        RAISE NOTICE 'Created notification ID: %', test_notification_id;
        
        -- Clean up
        DELETE FROM notifications WHERE id = test_notification_id;
        RAISE NOTICE 'Test notification cleaned up';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Direct insert FAILED: %', SQLERRM;
            RAISE NOTICE 'This means RLS policies are blocking inserts';
    END;
    
    RAISE NOTICE '=== DIRECT INSERT TEST END ===';
END $$;

-- 6. Test trigger function directly
DO $$
DECLARE
    test_job_id UUID;
    old_record RECORD;
    new_record RECORD;
    function_result TEXT;
BEGIN
    RAISE NOTICE '=== TESTING TRIGGER FUNCTION DIRECTLY ===';
    
    -- Create a test job
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Function Test Job', 'Testing trigger function directly', 'Test Location', '25', 'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa', NOW(), NOW()
    ) RETURNING * INTO new_record;
    
    test_job_id := new_record.id;
    RAISE NOTICE 'Test job created: %', test_job_id;
    
    -- Create old record for function test
    old_record := new_record;
    old_record.status := 'open';
    new_record.status := 'completed';
    
    -- Test the function directly
    BEGIN
        SELECT notify_admin_on_job_status_change() INTO function_result;
        RAISE NOTICE '✅ Function executed successfully';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Function execution failed: %', SQLERRM;
    END;
    
    -- Clean up
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
    RAISE NOTICE '=== FUNCTION TEST END ===';
END $$;

-- 7. Check current user and permissions
SELECT 
    'Current Context' as check_type,
    current_user as current_user,
    session_user as session_user,
    current_setting('role') as current_role;

-- 8. Check if we can see the trigger in information_schema
SELECT 
    'Information Schema Triggers' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'job_status_notification_trigger'; 