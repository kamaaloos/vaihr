-- Verify notifications and trigger functionality
-- Run this in the Supabase SQL Editor

-- Show recent notifications (last 10 minutes)
SELECT 
    'Recent Notifications' as info,
    id,
    title,
    message,
    type,
    data,
    created_at,
    user_id
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- Show recent job status changes
SELECT 
    'Recent Job Updates' as info,
    id,
    title,
    status,
    updated_at,
    admin_id
FROM jobs 
WHERE updated_at >= NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC;

-- Test the trigger again with a new job
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
BEGIN
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    RAISE NOTICE '=== TRIGGER TEST ===';
    RAISE NOTICE 'Notifications before: %', notification_count_before;
    
    -- Create a test job
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Verification Test Job',
        'Testing trigger verification',
        'Test Location',
        '25',
        'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        NOW(),
        NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE 'Test job created: %', test_job_id;
    
    -- Update job status to trigger notification
    UPDATE jobs 
    SET status = 'in_progress', updated_at = NOW() 
    WHERE id = test_job_id;
    
    RAISE NOTICE 'Job status updated to in_progress';
    
    -- Wait a moment
    PERFORM pg_sleep(1);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    RAISE NOTICE 'Notifications after: %', notification_count_after;
    RAISE NOTICE 'Difference: %', notification_count_after - notification_count_before;
    
    IF notification_count_after > notification_count_before THEN
        RAISE NOTICE '✅ SUCCESS: Trigger is working!';
    ELSE
        RAISE NOTICE '❌ FAILURE: No notification created';
    END IF;
    
    -- Clean up
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE 'Test job cleaned up';
    
END $$; 