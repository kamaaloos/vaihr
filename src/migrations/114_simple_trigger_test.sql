-- Simple Trigger Test
-- This script creates a test job and checks if notifications are created

-- 1. Check prerequisites
SELECT 
    'Prerequisites Check' as check_type,
    (SELECT COUNT(*) FROM users u LEFT JOIN user_status us ON u.id = us.user_id 
     WHERE u.role = 'driver' AND us.is_online = true) as online_drivers,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins,
    (SELECT COUNT(*) FROM jobs) as total_jobs,
    (SELECT COUNT(*) FROM notifications WHERE type = 'job_creation') as existing_notifications;

-- 2. Create a test job and monitor notifications
DO $$
DECLARE
    v_online_driver_id UUID;
    v_online_driver_name TEXT;
    v_admin_id UUID;
    v_admin_name TEXT;
    v_test_job_id UUID;
    v_notification_count_before INTEGER;
    v_notification_count_after INTEGER;
    v_trigger_fired BOOLEAN := false;
BEGIN
    RAISE NOTICE '=== Starting Trigger Test ===';
    
    -- Get an online driver
    SELECT u.id, u.name INTO v_online_driver_id, v_online_driver_name
    FROM users u
    LEFT JOIN user_status us ON u.id = us.user_id
    WHERE u.role = 'driver'
    AND us.is_online = true
    LIMIT 1;

    IF v_online_driver_id IS NULL THEN
        RAISE NOTICE '❌ ERROR: No online drivers found. Cannot test trigger.';
        RAISE NOTICE '   Make sure at least one driver is online (is_online = true in user_status table)';
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
        RAISE NOTICE '❌ ERROR: No admin found. Cannot test trigger.';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Found admin: % (ID: %)', v_admin_name, v_admin_id;

    -- Count notifications before
    SELECT COUNT(*) INTO v_notification_count_before
    FROM notifications
    WHERE user_id = v_online_driver_id
    AND type = 'job_creation';

    RAISE NOTICE '📊 Notifications before test: %', v_notification_count_before;

    -- Check if trigger exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'job_creation_notification_trigger'
        AND event_object_table = 'jobs'
    ) THEN
        RAISE NOTICE '✅ Trigger exists: job_creation_notification_trigger';
    ELSE
        RAISE NOTICE '❌ ERROR: Trigger does NOT exist!';
        RAISE NOTICE '   Run migration 108_fix_job_creation_notifications_for_online_drivers.sql';
        RETURN;
    END IF;

    -- Check if function exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'notify_drivers_on_job_creation'
    ) THEN
        RAISE NOTICE '✅ Function exists: notify_drivers_on_job_creation';
    ELSE
        RAISE NOTICE '❌ ERROR: Function does NOT exist!';
        RAISE NOTICE '   Run migration 108_fix_job_creation_notifications_for_online_drivers.sql';
        RETURN;
    END IF;

    -- Create a test job (this should trigger the notification)
    RAISE NOTICE '📝 Creating test job...';
    
    BEGIN
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
            'TEST JOB - Trigger Test ' || extract(epoch from now())::text,
            'This is a test job to verify the notification trigger',
            'Test Location',
            '50',
            '1 hour',
            NOW() + INTERVAL '1 day',
            'open',
            'https://xwaigporrtenhmlihbfc.supabase.co/storage/v1/object/public/Taxis/taxi.png'
        ) RETURNING id INTO v_test_job_id;

        RAISE NOTICE '✅ Test job created successfully: ID: %', v_test_job_id;
        v_trigger_fired := true;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ ERROR creating test job: % (SQL State: %)', SQLERRM, SQLSTATE;
            RETURN;
    END;

    -- Wait a moment for trigger to execute
    RAISE NOTICE '⏳ Waiting for trigger to execute...';
    PERFORM pg_sleep(2);

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
        RAISE NOTICE '📬 New notification details:';
        FOR rec IN 
            SELECT id, title, message, created_at
            FROM notifications
            WHERE user_id = v_online_driver_id
            AND type = 'job_creation'
            AND created_at > NOW() - INTERVAL '5 minutes'
            ORDER BY created_at DESC
            LIMIT 5
        LOOP
            RAISE NOTICE '   - ID: %, Title: %, Message: %, Created: %', 
                rec.id, rec.title, rec.message, rec.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ FAILED: Trigger did NOT create any notifications';
        RAISE NOTICE '   Expected at least 1 new notification, but count is the same';
        RAISE NOTICE '   This means the trigger either:';
        RAISE NOTICE '   1. Did not fire at all';
        RAISE NOTICE '   2. Fired but failed silently';
        RAISE NOTICE '   3. Fired but did not find any online drivers';
        RAISE NOTICE '   Check Supabase Dashboard > Logs > Postgres Logs for detailed error messages';
    END IF;

    -- Clean up test job
    BEGIN
        DELETE FROM jobs WHERE id = v_test_job_id;
        RAISE NOTICE '🧹 Test job deleted';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Warning: Could not delete test job: %', SQLERRM;
    END;

    RAISE NOTICE '=== Trigger Test Complete ===';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ FATAL ERROR in test script: % (SQL State: %)', SQLERRM, SQLSTATE;
        RAISE NOTICE '   Line: %', SQLSTATE;
END $$;

-- 3. Show recent notifications (last 5 minutes)
SELECT 
    'Recent Notifications' as check_type,
    n.id,
    n.user_id,
    u.name as driver_name,
    n.title,
    n.message,
    n.type,
    n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.type = 'job_creation'
AND n.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY n.created_at DESC
LIMIT 10;

-- 4. Show recent jobs (last 5 minutes)
SELECT 
    'Recent Jobs' as check_type,
    j.id,
    j.title,
    j.status,
    j.admin_id,
    j.created_at
FROM jobs j
WHERE j.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY j.created_at DESC
LIMIT 10;

