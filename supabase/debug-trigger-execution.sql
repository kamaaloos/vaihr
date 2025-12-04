-- Debug trigger execution step by step
-- Run this in the Supabase SQL Editor

-- Step 1: Check if the trigger function exists and can be called
DO $$
DECLARE
    function_exists BOOLEAN;
    function_result TEXT;
BEGIN
    RAISE NOTICE '=== STEP 1: CHECKING TRIGGER FUNCTION ===';
    
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'notify_admin_on_job_status_change'
    ) INTO function_exists;
    
    RAISE NOTICE 'Function exists: %', function_exists;
    
    IF function_exists THEN
        -- Try to call the function directly
        BEGIN
            SELECT notify_admin_on_job_status_change() INTO function_result;
            RAISE NOTICE '✅ Function can be called directly';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Function call failed: %', SQLERRM;
        END;
    END IF;
END $$;

-- Step 2: Test direct insert into notifications (bypassing trigger)
DO $$
DECLARE
    test_notification_id UUID;
    insert_success BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== STEP 2: TESTING DIRECT INSERT ===';
    
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
        RAISE NOTICE '✅ Direct insert SUCCESSFUL - RLS policies allow inserts';
        RAISE NOTICE 'Created notification ID: %', test_notification_id;
        
        -- Clean up
        DELETE FROM notifications WHERE id = test_notification_id;
        RAISE NOTICE 'Test notification cleaned up';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Direct insert FAILED: %', SQLERRM;
            RAISE NOTICE 'This means RLS policies are blocking inserts';
    END;
END $$;

-- Step 3: Test trigger with detailed logging
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
    old_status TEXT := 'open';
    new_status TEXT := 'completed';
    notification_record RECORD;
BEGIN
    RAISE NOTICE '=== STEP 3: TESTING TRIGGER WITH DETAILED LOGGING ===';
    
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    RAISE NOTICE 'Notifications before test: %', notification_count_before;
    
    -- Create a test job
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Debug Test Job', 'Testing trigger with detailed logging', 'Test Location', '25', old_status,
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa', NOW(), NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE 'Test job created with ID: %', test_job_id;
    RAISE NOTICE 'Job status: %', old_status;
    
    -- Update job status to trigger notification
    RAISE NOTICE 'Updating job status from % to %...', old_status, new_status;
    
    UPDATE jobs 
    SET status = new_status, updated_at = NOW() 
    WHERE id = test_job_id;
    
    RAISE NOTICE 'Job status updated successfully';
    
    -- Wait a moment for trigger to execute
    PERFORM pg_sleep(1);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    RAISE NOTICE 'Notifications after test: %', notification_count_after;
    RAISE NOTICE 'Difference: %', notification_count_after - notification_count_before;
    
    -- Check if any new notifications were created
    IF notification_count_after > notification_count_before THEN
        RAISE NOTICE '✅ SUCCESS: Trigger created % notification(s)', notification_count_after - notification_count_before;
        
        -- Show the new notifications
        RAISE NOTICE 'New notifications:';
        FOR notification_record IN 
            SELECT id, title, message, type, data, created_at 
            FROM notifications 
            WHERE created_at >= NOW() - INTERVAL '10 seconds'
            ORDER BY created_at DESC
        LOOP
            RAISE NOTICE '  ID: %, Title: %, Message: %, Type: %, Data: %, Created: %', 
                notification_record.id, notification_record.title, notification_record.message, 
                notification_record.type, notification_record.data, notification_record.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ FAILURE: No notifications were created';
        
        -- Check if the job was actually updated
        DECLARE
            current_job_status TEXT;
        BEGIN
            SELECT status INTO current_job_status FROM jobs WHERE id = test_job_id;
            RAISE NOTICE 'Current job status: %', current_job_status;
            
            IF current_job_status = new_status THEN
                RAISE NOTICE 'Job status was updated correctly, but trigger did not fire';
            ELSE
                RAISE NOTICE 'Job status was NOT updated correctly';
            END IF;
        END;
    END IF;
    
    -- Clean up test job
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
    RAISE NOTICE '=== TRIGGER TEST END ===';
END $$;

-- Step 4: Check trigger function source code
SELECT 
    'Trigger Function Source' as info,
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'notify_admin_on_job_status_change';

-- Step 5: Check current user context
SELECT 
    'Current Context' as info,
    current_user as current_user,
    session_user as session_user,
    current_setting('role') as current_role,
    current_setting('search_path') as search_path; 