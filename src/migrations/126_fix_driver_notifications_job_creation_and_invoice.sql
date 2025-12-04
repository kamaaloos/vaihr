-- Fix Driver Notifications for Job Creation and Invoice Creation
-- This migration ensures drivers receive notifications for:
-- 1. Job creation (when admin posts a new job)
-- 2. Invoice creation (when invoice is created after job completion)

-- ============================================================================
-- 1. FIX JOB CREATION NOTIFICATIONS - Notify ALL drivers (not just online)
-- ============================================================================

-- Drop and recreate the function to notify ALL drivers, not just online ones
DROP FUNCTION IF EXISTS notify_drivers_on_job_creation() CASCADE;

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
    v_drivers_notified_count INTEGER := 0;
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

    -- Get ALL drivers (not just online ones) - they should see all new jobs
    -- Online status can change, but they should still see the job in their notifications
    FOR v_driver_record IN
        SELECT 
            u.id,
            u.expo_push_token,
            COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
            u.preferences,
            COALESCE(us.is_online, false) as is_online
        FROM users u
        JOIN auth.users au ON u.id = au.id
        LEFT JOIN user_status us ON u.id = us.user_id
        WHERE u.role = 'driver'
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
                RAISE NOTICE 'Driver notification created for % (ID: %): New job "%s" (Online: %)', 
                    v_driver_record.name, v_driver_record.id, NEW.title, v_driver_record.is_online;
                
                v_drivers_notified_count := v_drivers_notified_count + 1;
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
                
                v_drivers_notified_count := v_drivers_notified_count + 1;
        END;
    END LOOP;

    RAISE NOTICE 'Created notifications for % drivers for job "%s"', v_drivers_notified_count, NEW.title;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the job creation
        RAISE NOTICE 'Error creating driver notifications: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS job_creation_notification_trigger ON jobs;
CREATE TRIGGER job_creation_notification_trigger
    AFTER INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_drivers_on_job_creation();

-- ============================================================================
-- 2. ENSURE INVOICE CREATION NOTIFICATIONS WORK FOR DRIVERS
-- ============================================================================

-- Drop and recreate the function to ensure driver notifications work
DROP FUNCTION IF EXISTS notify_admin_on_invoice_creation() CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_on_invoice_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_driver_id UUID;
    v_job_title TEXT;
    v_driver_name TEXT;
    v_driver_email TEXT;
    v_amount DECIMAL;
    v_invoice_number TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
BEGIN
    -- Only proceed for new invoice insertions
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Get invoice driver_id directly from NEW (most reliable)
    v_driver_id := NEW.driver_id;

    -- Get job and driver details
    SELECT 
        j.title,
        j.admin_id,
        COALESCE(au.raw_user_meta_data->>'name', au.email) as driver_name,
        au.email as driver_email
    INTO v_job_title, v_admin_id, v_driver_name, v_driver_email
    FROM jobs j
    LEFT JOIN auth.users au ON j.driver_id = au.id
    WHERE j.id = NEW.job_id;

    -- Skip if no admin_id or job not found
    IF v_admin_id IS NULL OR v_job_title IS NULL THEN
        RAISE NOTICE 'Skipping invoice notification: admin_id=% or job_title is NULL', v_admin_id;
        RETURN NEW;
    END IF;

    -- Ensure driver_id is set (use from NEW if not from job)
    IF v_driver_id IS NULL THEN
        SELECT driver_id INTO v_driver_id
        FROM jobs
        WHERE id = NEW.job_id;
    END IF;

    -- Get invoice details
    v_amount := NEW.amount;
    v_invoice_number := COALESCE(NEW.invoice_number, 'N/A');

    -- Set notification content for admin
    v_notification_title := 'Invoice Generated';
    v_notification_message := CASE 
        WHEN v_driver_name IS NOT NULL THEN 
            format('Invoice %s generated for job "%s" completed by %s (€%.2f)', 
                v_invoice_number, v_job_title, v_driver_name, v_amount)
        ELSE 
            format('Invoice %s generated for job "%s" (€%.2f)', 
                v_invoice_number, v_job_title, v_amount)
    END;

    -- Notify ADMIN
    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'data'
        ) THEN
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
                'invoice_creation',
                jsonb_build_object(
                    'invoiceId', NEW.id,
                    'invoiceNumber', v_invoice_number,
                    'jobId', NEW.job_id,
                    'jobTitle', v_job_title,
                    'driverId', COALESCE(v_driver_id::text, ''),
                    'driverName', COALESCE(v_driver_name, ''),
                    'driverEmail', COALESCE(v_driver_email, ''),
                    'amount', v_amount
                ),
                NOW()
            );
        ELSE
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
                'invoice_creation',
                NOW()
            );
        END IF;

        RAISE NOTICE '✅ Admin invoice notification created: % - % (Admin ID: %, Invoice ID: %)', 
            v_notification_title, v_notification_message, v_admin_id, NEW.id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error creating admin invoice notification: %', SQLERRM;
    END;

    -- Notify DRIVER (CRITICAL: Must have driver_id)
    IF v_driver_id IS NOT NULL THEN
        BEGIN
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'notifications' 
                AND column_name = 'data'
            ) THEN
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    data,
                    created_at
                ) VALUES (
                    v_driver_id,
                    'Invoice Created',
                    format('Invoice %s has been created for your completed job "%s" (€%.2f)', 
                        v_invoice_number, v_job_title, v_amount),
                    'invoice_creation',
                    jsonb_build_object(
                        'invoiceId', NEW.id,
                        'invoiceNumber', v_invoice_number,
                        'jobId', NEW.job_id,
                        'jobTitle', v_job_title,
                        'amount', v_amount,
                        'status', 'pending'
                    ),
                    NOW()
                );
            ELSE
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    created_at
                ) VALUES (
                    v_driver_id,
                    'Invoice Created',
                    format('Invoice %s has been created for your completed job "%s" (€%.2f)', 
                        v_invoice_number, v_job_title, v_amount),
                    'invoice_creation',
                    NOW()
                );
            END IF;

            RAISE NOTICE '✅ Driver invoice notification created: Invoice Created (Driver ID: %, Invoice ID: %)', 
                v_driver_id, NEW.id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error creating driver invoice notification: % (Driver ID: %, Invoice ID: %)', 
                    SQLERRM, v_driver_id, NEW.id;
        END;
    ELSE
        RAISE NOTICE '⚠️ WARNING: Cannot notify driver - driver_id is NULL (Invoice ID: %, Job ID: %)', 
            NEW.id, NEW.job_id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the invoice creation
        RAISE NOTICE '❌ Fatal error in notify_admin_on_invoice_creation: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS invoice_creation_notification_trigger ON invoices;
CREATE TRIGGER invoice_creation_notification_trigger
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_invoice_creation();

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION notify_drivers_on_job_creation() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admin_on_invoice_creation() TO authenticated;
GRANT EXECUTE ON FUNCTION should_notify_driver(JSONB, TEXT, TEXT) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$ 
DECLARE
    trigger_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Check triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE trigger_name IN (
        'job_creation_notification_trigger',
        'invoice_creation_notification_trigger'
    );

    -- Check functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_name IN (
        'notify_drivers_on_job_creation',
        'notify_admin_on_invoice_creation'
    )
    AND routine_type = 'FUNCTION';

    IF trigger_count = 2 AND function_count = 2 THEN
        RAISE NOTICE '✅ All triggers and functions created successfully';
        RAISE NOTICE '   - Job creation notifications: ALL drivers (not just online)';
        RAISE NOTICE '   - Invoice creation notifications: Admin + Driver';
    ELSE
        RAISE NOTICE '❌ ERROR: Triggers: %, Functions: %', trigger_count, function_count;
    END IF;
END $$;

