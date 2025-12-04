-- Create a function to handle job status change notifications
CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_admin_push_token TEXT;
    v_job_title TEXT;
    v_old_status TEXT;
    v_new_status TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_driver_name TEXT;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get job details
    v_job_title := NEW.title;
    v_old_status := OLD.status;
    v_new_status := NEW.status;
    v_admin_id := NEW.admin_id;

    -- Skip if no admin_id
    IF v_admin_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get driver name if available
    IF NEW.driver_id IS NOT NULL THEN
        SELECT COALESCE(raw_user_meta_data->>'name', email) INTO v_driver_name
        FROM auth.users
        WHERE id = NEW.driver_id;
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

    -- Get admin's push token
    SELECT expo_push_token INTO v_admin_push_token
    FROM users
    WHERE id = v_admin_id;

    -- Create notification record in database
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data,
        push_token,
        created_at
    ) VALUES (
        v_admin_id,
        v_notification_title,
        v_notification_message,
        'job',
        jsonb_build_object(
            'jobId', NEW.id,
            'oldStatus', v_old_status,
            'newStatus', v_new_status,
            'driverId', NEW.driver_id,
            'driverName', v_driver_name
        ),
        v_admin_push_token,
        NOW()
    );

    -- Log the notification for debugging
    RAISE NOTICE 'Admin notification created: % - %', v_notification_title, v_notification_message;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the job update
        RAISE NOTICE 'Error creating admin notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Create trigger to call the notification function on job status changes
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the trigger was created
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'job_status_notification_trigger'
        AND event_object_table = 'jobs'
    ) THEN
        RAISE NOTICE 'Job status notification trigger created successfully';
    ELSE
        RAISE NOTICE 'ERROR: Job status notification trigger was not created';
    END IF;
END $$; 