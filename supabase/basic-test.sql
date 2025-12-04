-- Basic test script - run each section separately
-- Run this in the Supabase SQL Editor

-- SECTION 1: Check if trigger function exists
SELECT 'SECTION 1: Function exists?' as test, 
       COUNT(*) as count 
FROM pg_proc 
WHERE proname = 'notify_admin_on_job_status_change';

-- SECTION 2: Test direct notification insert
INSERT INTO notifications (
    user_id, title, message, type, data, created_at
) VALUES (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
    'Test Notification',
    'Testing direct insert',
    'test',
    '{"test": true}'::jsonb,
    NOW()
) RETURNING id;

-- SECTION 3: Create a test job
INSERT INTO jobs (
    title, description, location, rate, status, admin_id, created_at, updated_at
) VALUES (
    'Trigger Test Job',
    'Testing trigger functionality',
    'Test Location',
    '25',
    'open',
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
    NOW(),
    NOW()
) RETURNING id;

-- SECTION 4: Update the job to trigger notification
UPDATE jobs 
SET status = 'completed', updated_at = NOW() 
WHERE title = 'Trigger Test Job' 
RETURNING id, status;

-- SECTION 5: Check if notification was created
SELECT 'SECTION 5: New notifications' as test,
       COUNT(*) as count
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '5 minutes';

-- SECTION 6: Clean up test data
DELETE FROM jobs WHERE title = 'Trigger Test Job';
DELETE FROM notifications WHERE title = 'Test Notification'; 