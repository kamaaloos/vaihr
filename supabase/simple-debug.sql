-- Simple step-by-step debug script
-- Run this in the Supabase SQL Editor

-- Step 1: Check if trigger function exists
SELECT 
    'Step 1: Function Check' as step,
    proname as function_name,
    proowner::regrole as owner,
    prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'notify_admin_on_job_status_change';

-- Step 2: Test direct insert into notifications
DO $$
DECLARE
    test_id UUID;
BEGIN
    RAISE NOTICE 'Step 2: Testing direct insert...';
    
    INSERT INTO notifications (
        user_id, title, message, type, data, created_at
    ) VALUES (
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        'Test Insert',
        'Testing direct insert',
        'test',
        '{"test": true}'::jsonb,
        NOW()
    ) RETURNING id INTO test_id;
    
    RAISE NOTICE '✅ Direct insert successful, ID: %', test_id;
    
    -- Clean up
    DELETE FROM notifications WHERE id = test_id;
    RAISE NOTICE 'Test notification cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Direct insert failed: %', SQLERRM;
END $$;

-- Step 3: Create a test job
DO $$
DECLARE
    job_id UUID;
BEGIN
    RAISE NOTICE 'Step 3: Creating test job...';
    
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Debug Test Job',
        'Testing trigger',
        'Test Location',
        '25',
        'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        NOW(),
        NOW()
    ) RETURNING id INTO job_id;
    
    RAISE NOTICE '✅ Test job created, ID: %', job_id;
    
    -- Clean up
    DELETE FROM jobs WHERE id = job_id;
    RAISE NOTICE 'Test job cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Job creation failed: %', SQLERRM;
END $$;

-- Step 4: Check notifications count
SELECT 
    'Step 4: Notifications Count' as step,
    COUNT(*) as total_notifications
FROM notifications;

-- Step 5: Check jobs count
SELECT 
    'Step 5: Jobs Count' as step,
    COUNT(*) as total_jobs
FROM jobs; 