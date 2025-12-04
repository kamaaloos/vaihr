-- Debug notifications with detailed logging
-- Run this in the Supabase SQL Editor

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS job_notification_trigger ON jobs;
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_on_job_changes();
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Step 2: Create notification function with extensive logging
CREATE OR REPLACE FUNCTION notify_on_job_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    driver_record RECORD;
    drivers_count INTEGER := 0;
    notification_id UUID;
BEGIN
    RAISE NOTICE '=== TRIGGER FIRED ===';
    RAISE NOTICE 'Operation: %', TG_OP;
    RAISE NOTICE 'Table: %', TG_TABLE_NAME;
    RAISE NOTICE 'Job ID: %', NEW.id;
    RAISE NOTICE 'Job Title: %', NEW.title;
    
    -- Handle INSERT (new job created)
    IF TG_OP = 'INSERT' THEN
        RAISE NOTICE '🆕 NEW JOB CREATED - Creating notifications for drivers';
        
        -- Count total drivers first
        SELECT COUNT(*) INTO drivers_count FROM users WHERE role = 'driver';
        RAISE NOTICE 'Total drivers found: %', drivers_count;
        
        -- Get all drivers and create notifications for them
        FOR driver_record IN 
            SELECT id, email, name FROM users 
            WHERE role = 'driver'
        LOOP
            RAISE NOTICE 'Creating notification for driver: % (%s)', driver_record.name, driver_record.email;
            
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                data,
                created_at
            ) VALUES (
                driver_record.id,
                'New Job Available',
                format('New job "%s" is available in %s', NEW.title, NEW.location),
                'new_job',
                jsonb_build_object(
                    'jobId', NEW.id,
                    'jobTitle', NEW.title,
                    'location', NEW.location,
                    'rate', NEW.rate,
                    'status', NEW.status
                ),
                NOW()
            ) RETURNING id INTO notification_id;
            
            RAISE NOTICE '✅ Notification created for driver %: ID %', driver_record.name, notification_id;
            drivers_count := drivers_count + 1;
        END LOOP;
        
        RAISE NOTICE '🎉 Created notifications for % drivers', drivers_count;
        
    -- Handle UPDATE (job status changed)
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE NOTICE '📝 JOB STATUS UPDATE DETECTED';
        RAISE NOTICE 'Old status: %', OLD.status;
        RAISE NOTICE 'New status: %', NEW.status;
        
        -- Only proceed if status actually changed
        IF OLD.status = NEW.status THEN
            RAISE NOTICE '⚠️ Status unchanged, skipping notification';
            RETURN NEW;
        END IF;
        
        RAISE NOTICE '🔄 Status changed from % to % - Creating admin notification', OLD.status, NEW.status;
        
        -- Create notification for admin
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            data,
            created_at
        ) VALUES (
            NEW.admin_id,
            'Job Status Changed',
            format('Job "%s" status changed from %s to %s', 
                NEW.title, OLD.status, NEW.status),
            'job_status',
            jsonb_build_object(
                'jobId', NEW.id,
                'oldStatus', OLD.status,
                'newStatus', NEW.status
            ),
            NOW()
        ) RETURNING id INTO notification_id;
        
        RAISE NOTICE '✅ Admin notification created: ID % for admin %', notification_id, NEW.admin_id;
    END IF;
    
    RAISE NOTICE '=== TRIGGER COMPLETED ===';
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR in trigger: %', SQLERRM;
        RAISE NOTICE 'Error detail: %', SQLSTATE;
        RETURN NEW;
END;
$$;

-- Step 3: Create trigger for both INSERT and UPDATE
CREATE TRIGGER job_notification_trigger
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_job_changes();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION notify_on_job_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_on_job_changes() TO service_role;

-- Step 5: Check current state
DO $$
DECLARE
    drivers_count INTEGER;
    notifications_count INTEGER;
    jobs_count INTEGER;
BEGIN
    RAISE NOTICE '=== CURRENT SYSTEM STATE ===';
    
    -- Count drivers
    SELECT COUNT(*) INTO drivers_count FROM users WHERE role = 'driver';
    RAISE NOTICE 'Total drivers: %', drivers_count;
    
    -- Count notifications
    SELECT COUNT(*) INTO notifications_count FROM notifications;
    RAISE NOTICE 'Total notifications: %', notifications_count;
    
    -- Count jobs
    SELECT COUNT(*) INTO jobs_count FROM jobs;
    RAISE NOTICE 'Total jobs: %', jobs_count;
    
    -- Show all drivers
    RAISE NOTICE 'Drivers in system:';
    FOR driver_record IN 
        SELECT id, email, name, role, online_status 
        FROM users 
        WHERE role = 'driver'
    LOOP
        RAISE NOTICE '  - % (%s) - Role: % - Status: %', 
            driver_record.name, driver_record.email, driver_record.role, driver_record.online_status;
    END LOOP;
    
    RAISE NOTICE '=== STATE CHECK COMPLETED ===';
END $$;

-- Step 6: Test job creation with detailed logging
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
    drivers_count INTEGER;
    notification_record RECORD;
BEGIN
    RAISE NOTICE '=== TESTING JOB CREATION ===';
    
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    -- Count drivers
    SELECT COUNT(*) INTO drivers_count FROM users WHERE role = 'driver';
    
    RAISE NOTICE 'Notifications before test: %', notification_count_before;
    RAISE NOTICE 'Drivers available: %', drivers_count;
    
    IF drivers_count = 0 THEN
        RAISE NOTICE '⚠️ WARNING: No drivers found in system!';
        RAISE NOTICE 'This is why no notifications are being created.';
        RETURN;
    END IF;
    
    -- Create a test job (this should trigger notifications for all drivers)
    RAISE NOTICE 'Creating test job...';
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Debug Test Job',
        'Testing notification system with detailed logging',
        'Debug Location',
        '40',
        'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        NOW(),
        NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE '✅ Test job created with ID: %', test_job_id;
    
    -- Wait a moment for trigger to execute
    RAISE NOTICE 'Waiting for trigger to execute...';
    PERFORM pg_sleep(3);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    
    RAISE NOTICE 'Notifications after test: %', notification_count_after;
    RAISE NOTICE 'New notifications created: %', notification_count_after - notification_count_before;
    
    IF notification_count_after > notification_count_before THEN
        RAISE NOTICE '🎉 SUCCESS: Notifications are working!';
        
        -- Show the new notifications
        RAISE NOTICE 'New notifications created:';
        FOR notification_record IN 
            SELECT id, title, message, type, user_id, created_at 
            FROM notifications 
            WHERE created_at >= NOW() - INTERVAL '10 seconds'
            ORDER BY created_at DESC
        LOOP
            RAISE NOTICE '  📧 ID: % | Title: % | Type: % | User: % | Created: %', 
                notification_record.id, notification_record.title, 
                notification_record.type, notification_record.user_id, notification_record.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ FAILURE: No notifications created';
        RAISE NOTICE 'Possible issues:';
        RAISE NOTICE '  1. No drivers in system';
        RAISE NOTICE '  2. Trigger not firing';
        RAISE NOTICE '  3. RLS policies blocking inserts';
    END IF;
    
    -- Clean up test job
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE '🧹 Test job cleaned up';
    
    RAISE NOTICE '=== TEST COMPLETED ===';
END $$; 