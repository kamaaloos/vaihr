-- Simple job notification system
-- Run this in the Supabase SQL Editor

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS job_notification_trigger ON jobs;
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_on_job_changes();
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Step 2: Create simple notification function
CREATE OR REPLACE FUNCTION notify_on_job_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    driver_record RECORD;
    drivers_count INTEGER := 0;
BEGIN
    -- Handle INSERT (new job created)
    IF TG_OP = 'INSERT' THEN
        RAISE NOTICE 'New job created: % - %', NEW.id, NEW.title;
        
        -- Get all drivers and create notifications for them
        FOR driver_record IN 
            SELECT id FROM users 
            WHERE role = 'driver'
        LOOP
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
            );
            
            drivers_count := drivers_count + 1;
        END LOOP;
        
        RAISE NOTICE 'Created notifications for % drivers', drivers_count;
        
    -- Handle UPDATE (job status changed)
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only proceed if status actually changed
        IF OLD.status = NEW.status THEN
            RETURN NEW;
        END IF;
        
        RAISE NOTICE 'Job status changed: % - % -> %', NEW.id, OLD.status, NEW.status;
        
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
        );
        
        RAISE NOTICE 'Created notification for admin: %', NEW.admin_id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating notification: %', SQLERRM;
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

-- Step 5: Test the notification system
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
    drivers_count INTEGER;
    notification_record RECORD;
BEGIN
    RAISE NOTICE '=== TESTING NOTIFICATION SYSTEM ===';
    
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    -- Count drivers
    SELECT COUNT(*) INTO drivers_count FROM users WHERE role = 'driver';
    
    RAISE NOTICE 'Notifications before: %', notification_count_before;
    RAISE NOTICE 'Total drivers: %', drivers_count;
    
    -- Create a test job (this should trigger notifications for all drivers)
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Test Job for All Drivers',
        'Testing driver notifications for all drivers',
        'Test Location',
        '35',
        'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        NOW(),
        NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE 'Test job created: %', test_job_id;
    
    -- Wait a moment for trigger to execute
    PERFORM pg_sleep(2);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    
    RAISE NOTICE 'Notifications after: %', notification_count_after;
    RAISE NOTICE 'New notifications created: %', notification_count_after - notification_count_before;
    
    IF notification_count_after > notification_count_before THEN
        RAISE NOTICE '✅ SUCCESS: Driver notifications are working!';
        
        -- Show the new notifications
        RAISE NOTICE 'New notifications:';
        FOR notification_record IN 
            SELECT id, title, message, type, user_id, created_at 
            FROM notifications 
            WHERE created_at >= NOW() - INTERVAL '10 seconds'
            ORDER BY created_at DESC
        LOOP
            RAISE NOTICE '  ID: %, Title: %, Message: %, Type: %, User: %, Created: %', 
                notification_record.id, notification_record.title, notification_record.message, 
                notification_record.type, notification_record.user_id, notification_record.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ FAILURE: No notifications created';
        RAISE NOTICE 'This might be because there are no drivers in the system';
    END IF;
    
    -- Clean up test job
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
    RAISE NOTICE '=== TEST COMPLETED ===';
END $$; 