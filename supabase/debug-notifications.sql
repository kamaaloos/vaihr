-- Debug notifications with logging
-- Run this in the Supabase SQL Editor

-- Step 1: Drop and recreate trigger function with logging
DROP TRIGGER IF EXISTS job_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_on_job_changes();

CREATE OR REPLACE FUNCTION notify_on_job_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    driver_record RECORD;
    drivers_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔔 TRIGGER FIRED: % on job %', TG_OP, NEW.id;
    
    IF TG_OP = 'INSERT' THEN
        RAISE NOTICE '📝 NEW JOB: %', NEW.title;
        
        -- Count drivers
        SELECT COUNT(*) INTO drivers_count FROM users WHERE role = 'driver';
        RAISE NOTICE '🚗 Found % drivers', drivers_count;
        
        -- Create notifications for all drivers
        FOR driver_record IN 
            SELECT id, name FROM users WHERE role = 'driver'
        LOOP
            RAISE NOTICE '📧 Creating notification for driver: %', driver_record.name;
            
            INSERT INTO notifications (
                user_id, title, message, type, data, created_at
            ) VALUES (
                driver_record.id,
                'New Job Available',
                format('New job "%s" is available', NEW.title),
                'new_job',
                jsonb_build_object('jobId', NEW.id, 'jobTitle', NEW.title),
                NOW()
            );
            
            drivers_count := drivers_count + 1;
        END LOOP;
        
        RAISE NOTICE '✅ Created % notifications', drivers_count;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        RAISE NOTICE '🔄 STATUS CHANGE: % -> %', OLD.status, NEW.status;
        
        INSERT INTO notifications (
            user_id, title, message, type, data, created_at
        ) VALUES (
            NEW.admin_id,
            'Job Status Changed',
            format('Job "%s" status changed to %s', NEW.title, NEW.status),
            'job_status',
            jsonb_build_object('jobId', NEW.id, 'newStatus', NEW.status),
            NOW()
        );
        
        RAISE NOTICE '✅ Admin notification created';
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERROR: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Step 2: Create trigger
CREATE TRIGGER job_notification_trigger
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_job_changes();

-- Step 3: Check current state
SELECT 'Current State' as info, 
       COUNT(*) as drivers 
FROM users WHERE role = 'driver';

SELECT 'Notifications' as info, 
       COUNT(*) as count 
FROM notifications;

-- Step 4: Test with logging
DO $$
DECLARE
    test_job_id UUID;
    before_count INTEGER;
    after_count INTEGER;
BEGIN
    RAISE NOTICE '🧪 STARTING TEST';
    
    SELECT COUNT(*) INTO before_count FROM notifications;
    RAISE NOTICE '📊 Notifications before: %', before_count;
    
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'Debug Test Job',
        'Testing notifications',
        'Test Location',
        '30',
        'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
        NOW(),
        NOW()
    ) RETURNING id INTO test_job_id;
    
    RAISE NOTICE '✅ Job created: %', test_job_id;
    
    PERFORM pg_sleep(2);
    
    SELECT COUNT(*) INTO after_count FROM notifications;
    RAISE NOTICE '📊 Notifications after: %', after_count;
    RAISE NOTICE '📈 Difference: %', after_count - before_count;
    
    DELETE FROM jobs WHERE id = test_job_id;
    RAISE NOTICE '🧹 Test completed';
END $$; 