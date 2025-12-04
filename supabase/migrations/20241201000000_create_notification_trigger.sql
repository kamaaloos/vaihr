-- Create notification trigger for job status changes
-- Run this in the Supabase SQL Editor

-- Step 1: Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Step 2: Create the trigger function
CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Create notification
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

    RAISE NOTICE 'Notification created for job %: % -> %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Step 3: Create the trigger
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;

-- Step 5: Test the trigger
-- Create a test job
INSERT INTO jobs (
    title,
    description,
    location,
    rate,
    status,
    admin_id,
    created_at,
    updated_at
) VALUES (
    'Migration Test Job',
    'Testing notification trigger from migration',
    'Test Location',
    '25',
    'open',
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
    NOW(),
    NOW()
);

-- Get the test job ID
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
BEGIN
    -- Get the test job ID
    SELECT id INTO test_job_id 
    FROM jobs 
    WHERE title = 'Migration Test Job' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    RAISE NOTICE 'Test job ID: %, Notifications before: %', test_job_id, notification_count_before;
    
    -- Update job status to trigger notification
    UPDATE jobs 
    SET status = 'completed', updated_at = NOW() 
    WHERE id = test_job_id;
    
    -- Wait a moment for trigger to execute
    PERFORM pg_sleep(1);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    
    RAISE NOTICE 'Notifications after: %, Difference: %', notification_count_after, notification_count_after - notification_count_before;
    
    -- Clean up test job
    DELETE FROM jobs WHERE id = test_job_id;
    
    RAISE NOTICE 'Test completed. Trigger is %', 
        CASE 
            WHEN notification_count_after > notification_count_before THEN 'WORKING'
            ELSE 'NOT WORKING'
        END;
END $$; 