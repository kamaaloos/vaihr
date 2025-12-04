-- Fix RLS policies to allow trigger function to create notifications
-- Run this in the Supabase SQL Editor

-- Step 1: First, let's see what RLS policies currently exist
SELECT 
    'Current RLS Policies' as info,
    policyname,
    tablename,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications';

-- Step 2: Drop existing RLS policies on notifications table
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;

-- Step 3: Create new RLS policies that allow trigger function to work
-- Policy 1: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id::text);

-- Policy 2: Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text);

-- Policy 3: Allow authenticated users to insert notifications (for trigger function)
CREATE POLICY "Authenticated users can insert notifications" ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy 4: Admin can manage all notifications
CREATE POLICY "Admin can manage all notifications" ON notifications
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    );

-- Step 4: Drop existing function and trigger
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Step 5: Create the trigger function with proper permissions
CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Create notification with proper authentication context
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

-- Step 6: Create the trigger
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO service_role;

-- Step 8: Test the trigger with new RLS policies
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
    test_result TEXT;
    notification_record RECORD;
BEGIN
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    RAISE NOTICE '=== TRIGGER TEST WITH NEW RLS POLICIES ===';
    RAISE NOTICE 'Notifications before test: %', notification_count_before;
    
    -- Create a test job
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'RLS Fix Test Job', 'Testing trigger with fixed RLS policies', 'Test Location', '25', 'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa', NOW(), NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE 'Test job created with ID: %', test_job_id;
    
    -- Update job status to trigger notification
    UPDATE jobs 
    SET status = 'completed', updated_at = NOW() 
    WHERE id = test_job_id;
    
    RAISE NOTICE 'Job status updated to completed';
    
    -- Wait a moment for trigger to execute
    PERFORM pg_sleep(2);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    
    RAISE NOTICE 'Notifications after test: %', notification_count_after;
    RAISE NOTICE 'Difference: %', notification_count_after - notification_count_before;
    
    -- Determine test result
    IF notification_count_after > notification_count_before THEN
        test_result := 'SUCCESS - Trigger is working with fixed RLS policies!';
    ELSE
        test_result := 'FAILURE - Trigger still not working';
    END IF;
    
    RAISE NOTICE 'Test result: %', test_result;
    
    -- Clean up test job
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
    RAISE NOTICE '=== TRIGGER TEST END ===';
    
    -- Show the new notification if any was created
    IF notification_count_after > notification_count_before THEN
        RAISE NOTICE 'New notification details:';
        FOR notification_record IN 
            SELECT id, title, message, type, data, created_at 
            FROM notifications 
            WHERE created_at >= NOW() - INTERVAL '10 seconds'
            ORDER BY created_at DESC
        LOOP
            RAISE NOTICE '  ID: %, Title: %, Message: %, Type: %, Data: %, Created: %', 
                notification_record.id, notification_record.title, notification_record.message, 
                notification_record.type, notification_record.data, notification_record.created_at;
        END LOOP;
    END IF;
    
END $$;

-- Step 9: Show the new RLS policies
SELECT 
    'New RLS Policies' as info,
    policyname,
    tablename,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname; 