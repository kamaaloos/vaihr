-- Fix Job Status Notification Trigger
-- This migration fixes the notify_admin_on_job_status_change function to work correctly
-- and ensures notifications are created when job status changes

-- Drop existing trigger
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;

-- Drop and recreate the function
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change() CASCADE;

-- Create updated function to handle job status change notifications
CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_job_title TEXT;
    v_old_status TEXT;
    v_new_status TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_driver_name TEXT;
    v_driver_email TEXT;
    v_notification_count INTEGER := 0;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get job details
    v_job_title := COALESCE(NEW.title, 'Untitled Job');
    v_old_status := OLD.status;
    v_new_status := NEW.status;
    v_admin_id := NEW.admin_id;

    -- Skip if no admin_id
    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'Skipping notification: No admin_id for job %', NEW.id;
        RETURN NEW;
    END IF;

    -- Get driver details if available (from users table, not auth.users)
    IF NEW.driver_id IS NOT NULL THEN
        SELECT 
            COALESCE(u.name, au.email) as name,
            au.email
        INTO v_driver_name, v_driver_email
        FROM users u
        JOIN auth.users au ON u.id = au.id
        WHERE u.id = NEW.driver_id;
    END IF;

    -- Determine notification content based on status change
    CASE 
        WHEN v_old_status = 'open' AND v_new_status = 'assigned' THEN
            v_notification_title := 'Job Accepted';
            v_notification_message := CASE 
                WHEN v_driver_name IS NOT NULL THEN 
                    format('Job "%s" has been accepted by %s', v_job_title, v_driver_name)
                ELSE 
                    format('Job "%s" has been accepted by a driver', v_job_title)
            END;
        
        WHEN v_old_status = 'assigned' AND v_new_status = 'in_progress' THEN
            v_notification_title := 'Job Started';
            v_notification_message := CASE 
                WHEN v_driver_name IS NOT NULL THEN 
                    format('Job "%s" has been started by %s', v_job_title, v_driver_name)
                ELSE 
                    format('Job "%s" has been started by a driver', v_job_title)
            END;
        
        WHEN v_old_status = 'in_progress' AND v_new_status = 'completed' THEN
            v_notification_title := 'Job Completed';
            v_notification_message := CASE 
                WHEN v_driver_name IS NOT NULL THEN 
                    format('Job "%s" has been completed by %s', v_job_title, v_driver_name)
                ELSE 
                    format('Job "%s" has been completed by a driver', v_job_title)
            END;
        
        WHEN v_new_status = 'cancelled' THEN
            v_notification_title := 'Job Cancelled';
            v_notification_message := CASE 
                WHEN v_driver_name IS NOT NULL THEN 
                    format('Job "%s" has been cancelled by %s', v_job_title, v_driver_name)
                ELSE 
                    format('Job "%s" has been cancelled', v_job_title)
            END;
        
        ELSE
            -- For any other status change, send a generic notification
            v_notification_title := 'Job Status Updated';
            v_notification_message := format('Job "%s" status changed from %s to %s', 
                v_job_title, v_old_status, v_new_status);
    END CASE;

    -- Log before attempting to insert
    RAISE NOTICE 'Attempting to create notification: Title: %, Message: %, Admin ID: %, Job ID: %', 
        v_notification_title, v_notification_message, v_admin_id, NEW.id;

    -- Create notification record in database
    -- Check if data column exists, if not insert without it
    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'data'
        ) THEN
            -- Insert with data column (for future features like navigation to job)
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                data,
                created_at
            ) VALUES (
                v_admin_id,
                v_notification_title,
                v_notification_message,
                'job_status',
                jsonb_build_object(
                    'jobId', NEW.id::text,
                    'oldStatus', v_old_status,
                    'newStatus', v_new_status,
                    'driverId', COALESCE(NEW.driver_id::text, ''),
                    'driverName', COALESCE(v_driver_name, ''),
                    'driverEmail', COALESCE(v_driver_email, '')
                ),
                NOW()
            );
        ELSE
            -- Insert without data column (basic notification)
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                created_at
            ) VALUES (
                v_admin_id,
                v_notification_title,
                v_notification_message,
                'job_status',
                NOW()
            );
        END IF;

        v_notification_count := 1;

        -- Log the notification for debugging
        RAISE NOTICE '✅ Admin notification created successfully: % - % (Admin ID: %, Job ID: %)', 
            v_notification_title, v_notification_message, v_admin_id, NEW.id;
            
        -- Verify the notification was actually inserted
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'data'
        ) THEN
            -- Verify using data column if it exists
            PERFORM 1 FROM notifications 
            WHERE user_id = v_admin_id 
            AND type = 'job_status'
            AND data->>'jobId' = NEW.id::text
            AND created_at > NOW() - INTERVAL '1 second';
        ELSE
            -- Verify without data column
            PERFORM 1 FROM notifications 
            WHERE user_id = v_admin_id 
            AND type = 'job_status'
            AND title = v_notification_title
            AND created_at > NOW() - INTERVAL '1 second';
        END IF;
        
        IF NOT FOUND THEN
            RAISE NOTICE '⚠️ WARNING: Notification insert appeared successful but verification failed';
        ELSE
            RAISE NOTICE '✅ Notification verified in database';
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail the job update
            RAISE NOTICE '❌ Error creating admin notification: % (SQL State: %)', SQLERRM, SQLSTATE;
            RAISE NOTICE '   Admin ID: %, Job ID: %, Old Status: %, New Status: %', 
                v_admin_id, NEW.id, v_old_status, v_new_status;
            RAISE NOTICE '   Driver ID: %, Driver Name: %', NEW.driver_id, v_driver_name;
            
            -- Try to get more details about the error
            BEGIN
                RAISE NOTICE '   Attempting to check if admin user exists...';
                PERFORM 1 FROM users WHERE id = v_admin_id;
                IF FOUND THEN
                    RAISE NOTICE '   ✅ Admin user exists';
                ELSE
                    RAISE NOTICE '   ❌ Admin user does NOT exist';
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '   Could not check admin user: %', SQLERRM;
            END;
    END;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the job update
        RAISE NOTICE '❌ Fatal error in notify_admin_on_job_status_change: % (SQL State: %)', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

-- Create trigger for job status change notifications
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verification
DO $$ 
DECLARE
    trigger_exists BOOLEAN;
    function_exists BOOLEAN;
BEGIN
    -- Check if trigger exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'job_status_notification_trigger'
        AND event_object_table = 'jobs'
    ) INTO trigger_exists;

    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'notify_admin_on_job_status_change'
        AND routine_type = 'FUNCTION'
    ) INTO function_exists;

    IF trigger_exists AND function_exists THEN
        RAISE NOTICE '✅ Job status notification trigger and function created successfully';
    ELSE
        RAISE NOTICE '❌ ERROR: Trigger exists: %, Function exists: %', trigger_exists, function_exists;
    END IF;
END $$;

