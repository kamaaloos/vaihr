-- Fix Job Creation Notifications for Online Drivers
-- This migration fixes the notify_drivers_on_job_creation function to correctly
-- check online status from user_status table and notify all online drivers

-- Drop existing trigger
DROP TRIGGER IF EXISTS job_creation_notification_trigger ON jobs;

-- Drop and recreate the function with correct online status check
DROP FUNCTION IF EXISTS notify_drivers_on_job_creation() CASCADE;

-- Ensure should_notify_driver function exists (helper function)
CREATE OR REPLACE FUNCTION should_notify_driver(
    driver_preferences JSONB,
    job_location TEXT,
    job_rate TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- If no preferences, notify all drivers
    IF driver_preferences IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check excluded locations
    IF driver_preferences ? 'excludedLocations' THEN
        IF job_location = ANY(ARRAY(SELECT jsonb_array_elements_text(driver_preferences->'excludedLocations'))) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Check minimum rate
    IF driver_preferences ? 'minRate' THEN
        IF (job_rate::DECIMAL) < (driver_preferences->>'minRate')::DECIMAL THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- Create updated function to notify online drivers
CREATE OR REPLACE FUNCTION notify_drivers_on_job_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_name TEXT;
    v_admin_email TEXT;
    v_driver_record RECORD;
    v_online_drivers_count INTEGER := 0;
BEGIN
    -- Only proceed for new job insertions
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Get admin details from auth.users
    SELECT 
        COALESCE(raw_user_meta_data->>'name', email) as name,
        email
    INTO v_admin_name, v_admin_email
    FROM auth.users
    WHERE id = NEW.admin_id;

    -- Get all online drivers from user_status table
    -- Join with users table to get driver info and push tokens
    FOR v_driver_record IN
        SELECT 
            u.id,
            u.expo_push_token,
            COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
            u.preferences,
            us.is_online
        FROM users u
        JOIN auth.users au ON u.id = au.id
        LEFT JOIN user_status us ON u.id = us.user_id
        WHERE u.role = 'driver'
        AND us.is_online = true
    LOOP
        -- Check if driver should be notified based on preferences
        -- If should_notify_driver function doesn't exist or returns true, notify
        BEGIN
            IF should_notify_driver(v_driver_record.preferences, NEW.location, NEW.rate) THEN
                -- Create notification record for driver
                -- Check if data column exists
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'notifications' 
                    AND column_name = 'data'
                ) THEN
                    -- Insert with data column
                    INSERT INTO notifications (
                        user_id,
                        title,
                        message,
                        type,
                        data,
                        created_at
                    ) VALUES (
                        v_driver_record.id,
                        'New Job Available',
                        format('%s posted a new job: %s', COALESCE(v_admin_name, 'Admin'), NEW.title),
                        'job_creation',
                        jsonb_build_object(
                            'jobId', NEW.id::text,
                            'jobTitle', NEW.title,
                            'jobLocation', NEW.location,
                            'jobRate', NEW.rate,
                            'adminName', v_admin_name,
                            'adminEmail', v_admin_email
                        ),
                        NOW()
                    );
                ELSE
                    -- Insert without data column
                    INSERT INTO notifications (
                        user_id,
                        title,
                        message,
                        type,
                        created_at
                    ) VALUES (
                        v_driver_record.id,
                        'New Job Available',
                        format('%s posted a new job: %s', COALESCE(v_admin_name, 'Admin'), NEW.title),
                        'job_creation',
                        NOW()
                    );
                END IF;

                -- Log the notification
                RAISE NOTICE 'Driver notification created for % (ID: %): New job "%s"', 
                    v_driver_record.name, v_driver_record.id, NEW.title;
                
                v_online_drivers_count := v_online_drivers_count + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- If should_notify_driver function doesn't exist, just notify all drivers
                -- Check if data column exists
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'notifications' 
                    AND column_name = 'data'
                ) THEN
                    -- Insert with data column
                    INSERT INTO notifications (
                        user_id,
                        title,
                        message,
                        type,
                        data,
                        created_at
                    ) VALUES (
                        v_driver_record.id,
                        'New Job Available',
                        format('%s posted a new job: %s', COALESCE(v_admin_name, 'Admin'), NEW.title),
                        'job_creation',
                        jsonb_build_object(
                            'jobId', NEW.id::text,
                            'jobTitle', NEW.title,
                            'jobLocation', NEW.location,
                            'jobRate', NEW.rate,
                            'adminName', v_admin_name,
                            'adminEmail', v_admin_email
                        ),
                        NOW()
                    );
                ELSE
                    -- Insert without data column
                    INSERT INTO notifications (
                        user_id,
                        title,
                        message,
                        type,
                        created_at
                    ) VALUES (
                        v_driver_record.id,
                        'New Job Available',
                        format('%s posted a new job: %s', COALESCE(v_admin_name, 'Admin'), NEW.title),
                        'job_creation',
                        NOW()
                    );
                END IF;

                RAISE NOTICE 'Driver notification created for % (ID: %): New job "%s" (preference check failed, notified anyway)', 
                    v_driver_record.name, v_driver_record.id, NEW.title;
                
                v_online_drivers_count := v_online_drivers_count + 1;
        END;
    END LOOP;

    RAISE NOTICE 'Created notifications for % online drivers for job "%s"', v_online_drivers_count, NEW.title;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the job creation
        RAISE NOTICE 'Error creating driver notifications: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Create trigger for job creation notifications
CREATE TRIGGER job_creation_notification_trigger
    AFTER INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_drivers_on_job_creation();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_drivers_on_job_creation() TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verification
DO $$ 
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'job_creation_notification_trigger'
        AND event_object_table = 'jobs'
    ) INTO trigger_exists;

    IF trigger_exists THEN
        RAISE NOTICE '✅ Job creation notification trigger created successfully';
    ELSE
        RAISE NOTICE '❌ ERROR: Job creation notification trigger was NOT created';
    END IF;
END $$;

