-- Diagnose Job Status Notifications
-- This script helps identify why notifications aren't being created when job status changes

-- 1. Check if the trigger exists and is enabled
SELECT 
    'Trigger Status' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    event_object_table,
    action_condition
FROM information_schema.triggers 
WHERE trigger_name = 'job_status_notification_trigger'
ORDER BY trigger_name;

-- 2. Check if the function exists
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'notify_admin_on_job_status_change'
ORDER BY routine_name;

-- 3. Check notifications table structure
SELECT 
    'Notifications Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 3a. Check if data column exists
SELECT 
    'Data Column Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'data'
        ) THEN '✅ data column EXISTS'
        ELSE '❌ data column DOES NOT EXIST - Need to add it'
    END as data_column_status;

-- 4. Check recent job status changes
SELECT 
    'Recent Job Status Changes' as check_type,
    id,
    title,
    status,
    admin_id,
    driver_id,
    updated_at,
    created_at
FROM jobs
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;

-- 5. Check if notifications were created for recent job changes
-- First check if data column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        -- Data column exists - use it
        PERFORM 1;
    ELSE
        -- Data column doesn't exist - show basic notification info
        RAISE NOTICE '⚠️ data column does not exist in notifications table';
    END IF;
END $$;

-- Show recent notifications (with or without data column)
SELECT 
    'Recent Notifications' as check_type,
    n.id,
    n.user_id,
    n.title,
    n.message,
    n.type,
    n.read,
    n.created_at
FROM notifications n
WHERE n.type = 'job_status'
AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC
LIMIT 10;

-- 6. Check admin user details
SELECT 
    'Admin User Details' as check_type,
    u.id,
    u.name,
    u.email,
    u.role,
    COUNT(n.id) as notification_count
FROM users u
LEFT JOIN notifications n ON u.id = n.user_id AND n.type = 'job_status'
WHERE u.role = 'admin'
GROUP BY u.id, u.name, u.email, u.role
ORDER BY u.name;

-- 7. Test the trigger function manually with a recent job
DO $$
DECLARE
    v_test_job_id UUID;
    v_test_admin_id UUID;
    v_test_driver_id UUID;
    v_notification_count INTEGER;
BEGIN
    -- Get a recent job that changed status
    SELECT id, admin_id, driver_id INTO v_test_job_id, v_test_admin_id, v_test_driver_id
    FROM jobs
    WHERE updated_at > NOW() - INTERVAL '1 hour'
    AND status = 'assigned'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_test_job_id IS NULL THEN
        RAISE NOTICE 'No recent job found for testing';
        RETURN;
    END IF;

    RAISE NOTICE 'Testing with job ID: %, Admin ID: %, Driver ID: %', 
        v_test_job_id, v_test_admin_id, v_test_driver_id;

    -- Count existing notifications for this admin
    -- Check if data column exists first
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        SELECT COUNT(*) INTO v_notification_count
        FROM notifications
        WHERE user_id = v_test_admin_id
        AND type = 'job_status'
        AND (data IS NULL OR data->>'jobId' = v_test_job_id::text);
    ELSE
        SELECT COUNT(*) INTO v_notification_count
        FROM notifications
        WHERE user_id = v_test_admin_id
        AND type = 'job_status';
    END IF;

    RAISE NOTICE 'Existing notifications for this job: %', v_notification_count;

    -- Check if we can insert a test notification
    BEGIN
        -- Check if data column exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'data'
        ) THEN
            -- Insert with data column
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                data,
                created_at
            ) VALUES (
                v_test_admin_id,
                'Test Notification',
                'This is a test notification to verify the table structure',
                'job_status',
                jsonb_build_object(
                    'jobId', v_test_job_id,
                    'oldStatus', 'open',
                    'newStatus', 'assigned',
                    'test', true
                ),
                NOW()
            );
            
            -- Clean up test notification
            DELETE FROM notifications 
            WHERE user_id = v_test_admin_id 
            AND title = 'Test Notification'
            AND data->>'test' = 'true';
        ELSE
            -- Insert without data column
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                created_at
            ) VALUES (
                v_test_admin_id,
                'Test Notification',
                'This is a test notification to verify the table structure (no data column)',
                'job_status',
                NOW()
            );
            
            -- Clean up test notification
            DELETE FROM notifications 
            WHERE user_id = v_test_admin_id 
            AND title = 'Test Notification';
        END IF;

        RAISE NOTICE '✅ Test notification inserted and deleted successfully';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error inserting test notification: % (SQL State: %)', SQLERRM, SQLSTATE;
    END;
END $$;

-- 8. Check RLS policies on notifications table
SELECT 
    'RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 9. Check if RLS is enabled on notifications table
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'notifications';

-- 10. Summary
SELECT 
    'Summary' as check_type,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'job_status_notification_trigger') as trigger_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'notify_admin_on_job_status_change') as function_exists,
    (SELECT COUNT(*) FROM notifications WHERE type = 'job_status' AND created_at > NOW() - INTERVAL '1 hour') as recent_notifications,
    (SELECT COUNT(*) FROM jobs WHERE updated_at > NOW() - INTERVAL '1 hour' AND status != 'open') as recent_job_changes;

