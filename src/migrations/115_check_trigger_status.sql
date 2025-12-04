-- Check Trigger Status and Permissions
-- This script verifies the trigger is properly set up and enabled

-- 1. Check if trigger exists and is enabled
SELECT 
    'Trigger Status' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_condition,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE trigger_name = 'job_creation_notification_trigger'
AND event_object_table = 'jobs';

-- 2. Check function exists and permissions
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type,
    routine_schema,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'notify_drivers_on_job_creation';

-- 3. Check if should_notify_driver function exists
SELECT 
    'Helper Function Status' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'should_notify_driver';

-- 4. Check table permissions
SELECT 
    'Table Permissions' as check_type,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'jobs'
AND grantee IN ('authenticated', 'public', 'anon')
ORDER BY grantee, privilege_type;

-- 5. Check notifications table permissions
SELECT 
    'Notifications Table Permissions' as check_type,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'notifications'
AND grantee IN ('authenticated', 'public', 'anon')
ORDER BY grantee, privilege_type;

-- 6. Check trigger details (owner info not available in information_schema)
SELECT 
    'Trigger Details' as check_type,
    trigger_name,
    trigger_schema,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'job_creation_notification_trigger';

-- 7. Test direct function call (simulate what trigger does)
DO $$
DECLARE
    v_test_admin_id UUID;
    v_test_job_id UUID;
    v_result TEXT;
BEGIN
    -- Get an admin
    SELECT u.id INTO v_test_admin_id
    FROM users u
    WHERE u.role = 'admin'
    LIMIT 1;

    IF v_test_admin_id IS NULL THEN
        RAISE NOTICE 'No admin found for testing';
        RETURN;
    END IF;

    -- Create a test job
    INSERT INTO jobs (
        admin_id,
        title,
        description,
        location,
        rate,
        duration,
        date,
        status,
        image_url
    ) VALUES (
        v_test_admin_id,
        'DIRECT TEST JOB',
        'Testing direct insert',
        'Test',
        '50',
        '1 hour',
        NOW() + INTERVAL '1 day',
        'open',
        'https://xwaigporrtenhmlihbfc.supabase.co/storage/v1/object/public/Taxis/taxi.png'
    ) RETURNING id INTO v_test_job_id;

    RAISE NOTICE 'Test job created: %', v_test_job_id;
    
    -- Wait for trigger
    PERFORM pg_sleep(1);
    
    -- Check notifications
    SELECT COUNT(*)::TEXT INTO v_result
    FROM notifications
    WHERE type = 'job_creation'
    AND created_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Notifications created in last minute: %', v_result;
    
    -- Clean up
    DELETE FROM jobs WHERE id = v_test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- 8. Check recent job insertions and their notifications
SELECT 
    'Job-Notification Correlation' as check_type,
    j.id as job_id,
    j.title as job_title,
    j.created_at as job_created,
    COUNT(n.id) as notification_count,
    MAX(n.created_at) as latest_notification
FROM jobs j
LEFT JOIN notifications n ON n.type = 'job_creation' 
    AND n.created_at BETWEEN j.created_at AND j.created_at + INTERVAL '10 seconds'
WHERE j.created_at > NOW() - INTERVAL '1 hour'
GROUP BY j.id, j.title, j.created_at
ORDER BY j.created_at DESC
LIMIT 10;

