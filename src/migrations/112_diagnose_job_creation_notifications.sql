-- Diagnose Job Creation Notifications
-- This script helps identify why drivers aren't receiving notifications when jobs are created

-- 1. Check if the trigger exists
SELECT 
    'Trigger Status' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'job_creation_notification_trigger'
ORDER BY trigger_name;

-- 2. Check if the function exists
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'notify_drivers_on_job_creation'
ORDER BY routine_name;

-- 3. Check online drivers and their push tokens
SELECT 
    'Online Drivers Status' as check_type,
    u.id,
    u.name,
    u.email,
    u.role,
    u.expo_push_token IS NOT NULL as has_push_token,
    CASE 
        WHEN u.expo_push_token IS NOT NULL THEN 'Has Token'
        ELSE 'Missing Token'
    END as token_status,
    us.is_online,
    us.last_seen,
    CASE 
        WHEN us.is_online = true THEN 'ONLINE'
        WHEN us.is_online IS NULL THEN 'NO STATUS RECORD'
        ELSE 'OFFLINE'
    END as online_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver'
ORDER BY us.is_online DESC NULLS LAST, u.expo_push_token DESC NULLS LAST;

-- 4. Count online drivers with/without push tokens
SELECT 
    'Driver Statistics' as check_type,
    COUNT(*) as total_drivers,
    COUNT(CASE WHEN us.is_online = true THEN 1 END) as online_drivers,
    COUNT(CASE WHEN u.expo_push_token IS NOT NULL THEN 1 END) as drivers_with_token,
    COUNT(CASE WHEN us.is_online = true 
               AND u.expo_push_token IS NOT NULL THEN 1 END) as online_drivers_with_token,
    COUNT(CASE WHEN us.is_online = true 
               AND u.expo_push_token IS NULL THEN 1 END) as online_drivers_without_token
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver';

-- 5. Check recent job creation notifications
SELECT 
    'Recent Job Creation Notifications' as check_type,
    n.id,
    n.user_id,
    n.title,
    n.message,
    n.type,
    n.read,
    n.created_at,
    u.name as driver_name,
    u.expo_push_token IS NOT NULL as driver_has_token
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.type = 'job_creation'
AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC
LIMIT 20;

-- 6. Check recent jobs created
SELECT 
    'Recent Jobs Created' as check_type,
    j.id,
    j.title,
    j.status,
    j.admin_id,
    j.created_at,
    au.email as admin_email
FROM jobs j
JOIN auth.users au ON j.admin_id = au.id
WHERE j.created_at > NOW() - INTERVAL '1 hour'
ORDER BY j.created_at DESC
LIMIT 10;

-- 7. Test notification creation for a specific driver
DO $$
DECLARE
    v_test_driver_id UUID;
    v_test_driver_name TEXT;
    v_test_job_id UUID;
    v_notification_count INTEGER;
BEGIN
    -- Get an online driver
    SELECT u.id, u.name INTO v_test_driver_id, v_test_driver_name
    FROM users u
    LEFT JOIN user_status us ON u.id = us.user_id
    WHERE u.role = 'driver'
    AND us.is_online = true
    LIMIT 1;

    IF v_test_driver_id IS NULL THEN
        RAISE NOTICE 'No online drivers found for testing';
        RETURN;
    END IF;

    -- Get a recent job
    SELECT id INTO v_test_job_id
    FROM jobs
    WHERE created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_test_job_id IS NULL THEN
        RAISE NOTICE 'No recent jobs found for testing';
        RETURN;
    END IF;

    RAISE NOTICE 'Testing with driver: % (ID: %), Job ID: %', 
        v_test_driver_name, v_test_driver_id, v_test_job_id;

    -- Count existing notifications for this driver and job
    -- Check if data column exists first
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        SELECT COUNT(*) INTO v_notification_count
        FROM notifications
        WHERE user_id = v_test_driver_id
        AND type = 'job_creation'
        AND (data IS NULL OR data->>'jobId' = v_test_job_id::text);
    ELSE
        SELECT COUNT(*) INTO v_notification_count
        FROM notifications
        WHERE user_id = v_test_driver_id
        AND type = 'job_creation';
    END IF;

    RAISE NOTICE 'Existing notifications for this driver and job: %', v_notification_count;

    -- Try to create a test notification
    BEGIN
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            created_at
        ) VALUES (
            v_test_driver_id,
            'Test Job Notification',
            'This is a test notification to verify the system',
            'job_creation',
            NOW()
        );

        RAISE NOTICE '✅ Test notification created successfully';
        
        -- Clean up
        DELETE FROM notifications 
        WHERE user_id = v_test_driver_id 
        AND title = 'Test Job Notification';
        
        RAISE NOTICE '✅ Test notification cleaned up';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error creating test notification: % (SQL State: %)', SQLERRM, SQLSTATE;
    END;
END $$;

-- 8. Summary
SELECT 
    'Summary' as check_type,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'job_creation_notification_trigger') as trigger_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'notify_drivers_on_job_creation') as function_exists,
    (SELECT COUNT(*) FROM users u LEFT JOIN user_status us ON u.id = us.user_id 
     WHERE u.role = 'driver' AND us.is_online = true) as online_drivers,
    (SELECT COUNT(*) FROM users u LEFT JOIN user_status us ON u.id = us.user_id 
     WHERE u.role = 'driver' AND us.is_online = true 
     AND u.expo_push_token IS NOT NULL) as online_drivers_with_token,
    (SELECT COUNT(*) FROM notifications WHERE type = 'job_creation' AND created_at > NOW() - INTERVAL '1 hour') as recent_notifications;

