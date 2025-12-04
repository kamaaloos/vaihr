-- Test Job Creation Notification Trigger
-- This script manually tests if the trigger is working correctly

-- 1. Check current state
SELECT 
    'Current State' as check_type,
    (SELECT COUNT(*) FROM jobs) as total_jobs,
    (SELECT COUNT(*) FROM notifications WHERE type = 'job_creation') as total_job_notifications,
    (SELECT COUNT(*) FROM users u LEFT JOIN user_status us ON u.id = us.user_id 
     WHERE u.role = 'driver' AND us.is_online = true) as online_drivers;

-- 2. Get an online driver and admin for testing
DO $$
DECLARE
    v_online_driver_id UUID;
    v_online_driver_name TEXT;
    v_admin_id UUID;
    v_admin_name TEXT;
    v_test_job_id UUID;
    v_notification_count_before INTEGER;
    v_notification_count_after INTEGER;
    rec RECORD;
BEGIN
    -- Get an online driver
    SELECT u.id, u.name INTO v_online_driver_id, v_online_driver_name
    FROM users u
    LEFT JOIN user_status us ON u.id = us.user_id
    WHERE u.role = 'driver'
    AND us.is_online = true
    LIMIT 1;

    IF v_online_driver_id IS NULL THEN
        RAISE NOTICE '❌ No online drivers found. Cannot test trigger.';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Found online driver: % (ID: %)', v_online_driver_name, v_online_driver_id;

    -- Get an admin
    SELECT u.id, COALESCE(u.name, au.email) INTO v_admin_id, v_admin_name
    FROM users u
    JOIN auth.users au ON u.id = au.id
    WHERE u.role = 'admin'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE '❌ No admin found. Cannot test trigger.';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Found admin: % (ID: %)', v_admin_name, v_admin_id;

    -- Count notifications before
    SELECT COUNT(*) INTO v_notification_count_before
    FROM notifications
    WHERE user_id = v_online_driver_id
    AND type = 'job_creation';

    RAISE NOTICE '📊 Notifications before test: %', v_notification_count_before;

    -- Create a test job (this should trigger the notification)
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
        v_admin_id,
        'TEST JOB - Trigger Test',
        'This is a test job to verify the notification trigger',
        'Test Location',
        '50',
        '1 hour',
        NOW() + INTERVAL '1 day',
        'open',
        'https://xwaigporrtenhmlihbfc.supabase.co/storage/v1/object/public/Taxis/taxi.png'
    ) RETURNING id INTO v_test_job_id;

    RAISE NOTICE '✅ Test job created: ID: %', v_test_job_id;

    -- Wait a moment for trigger to execute
    PERFORM pg_sleep(1);

    -- Count notifications after
    SELECT COUNT(*) INTO v_notification_count_after
    FROM notifications
    WHERE user_id = v_online_driver_id
    AND type = 'job_creation';

    RAISE NOTICE '📊 Notifications after test: %', v_notification_count_after;

    IF v_notification_count_after > v_notification_count_before THEN
        RAISE NOTICE '✅ SUCCESS: Trigger created % new notification(s)!', 
            (v_notification_count_after - v_notification_count_before);
        
        -- Show the new notification
        RAISE NOTICE 'New notification details:';
        FOR rec IN 
            SELECT id, title, message, created_at
            FROM notifications
            WHERE user_id = v_online_driver_id
            AND type = 'job_creation'
            AND created_at > NOW() - INTERVAL '1 minute'
        LOOP
            RAISE NOTICE '  - ID: %, Title: %, Message: %, Created: %', 
                rec.id, rec.title, rec.message, rec.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ FAILED: Trigger did NOT create any notifications';
        RAISE NOTICE '   Expected at least 1 new notification, but count is the same';
    END IF;

    -- Clean up test job
    DELETE FROM jobs WHERE id = v_test_job_id;
    RAISE NOTICE '🧹 Test job deleted';

END $$;

-- 3. Check if trigger is actually enabled
SELECT 
    'Trigger Details' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_condition,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'job_creation_notification_trigger';

-- 4. Check function definition (first 500 chars)
SELECT 
    'Function Definition' as check_type,
    routine_name,
    LEFT(routine_definition, 500) as function_preview
FROM information_schema.routines 
WHERE routine_name = 'notify_drivers_on_job_creation';

-- 5. Check if should_notify_driver function exists
SELECT 
    'should_notify_driver Function' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'should_notify_driver';

-- 6. Test should_notify_driver function if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'should_notify_driver'
    ) THEN
        RAISE NOTICE '✅ should_notify_driver function exists';
        RAISE NOTICE 'Testing with NULL preferences: %', should_notify_driver(NULL, 'Test Location', '50');
        RAISE NOTICE 'Testing with empty preferences: %', should_notify_driver('{}'::jsonb, 'Test Location', '50');
    ELSE
        RAISE NOTICE '❌ should_notify_driver function does NOT exist';
        RAISE NOTICE '   This should cause an exception in the trigger, which should still create notifications';
    END IF;
END $$;

-- 7. Check if online driver has matching auth.users record
SELECT 
    'Driver Auth Check' as check_type,
    u.id as driver_id,
    u.name as driver_name,
    u.role,
    CASE WHEN au.id IS NOT NULL THEN 'Has Auth Record' ELSE 'Missing Auth Record' END as auth_status,
    us.is_online,
    u.expo_push_token IS NOT NULL as has_token
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
LEFT JOIN user_status us ON u.id = us.user_id
WHERE u.role = 'driver'
AND us.is_online = true;

-- 8. Check recent Supabase logs (if accessible)
-- Note: This won't work in SQL editor, but you can check Supabase Dashboard > Logs > Postgres Logs
SELECT 
    'Check Logs' as check_type,
    'Go to Supabase Dashboard > Logs > Postgres Logs to see RAISE NOTICE messages from the trigger' as instruction;

