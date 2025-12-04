-- Add Driver Notifications on Job Completion and Invoice Creation
-- This migration ensures that when a job is completed and an invoice is created,
-- both the admin AND the driver receive notifications

-- ============================================================================
-- 1. UPDATE JOB STATUS CHANGE NOTIFICATION TO INCLUDE DRIVER
-- ============================================================================

-- Drop and recreate the function to notify both admin and driver
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change() CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_driver_id UUID;
    v_job_title TEXT;
    v_old_status TEXT;
    v_new_status TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_driver_name TEXT;
    v_driver_email TEXT;
    v_admin_name TEXT;
    v_admin_email TEXT;
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
    v_driver_id := NEW.driver_id;

    -- Skip if no admin_id
    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'Skipping notification: No admin_id for job %', NEW.id;
        RETURN NEW;
    END IF;

    -- Get driver details if available
    IF v_driver_id IS NOT NULL THEN
        SELECT 
            COALESCE(u.name, au.email) as name,
            au.email
        INTO v_driver_name, v_driver_email
        FROM users u
        JOIN auth.users au ON u.id = au.id
        WHERE u.id = v_driver_id;
    END IF;

    -- Get admin details
    SELECT 
        COALESCE(u.name, au.email) as name,
        au.email
    INTO v_admin_name, v_admin_email
    FROM users u
    JOIN auth.users au ON u.id = au.id
    WHERE u.id = v_admin_id;

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
                'job_status',
                jsonb_build_object(
                    'jobId', NEW.id::text,
                    'oldStatus', v_old_status,
                    'newStatus', v_new_status,
                    'driverId', COALESCE(v_driver_id::text, ''),
                    'driverName', COALESCE(v_driver_name, ''),
                    'driverEmail', COALESCE(v_driver_email, '')
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
                'job_status',
                NOW()
            );
        END IF;

        RAISE NOTICE '✅ Admin notification created: % - % (Admin ID: %, Job ID: %)', 
            v_notification_title, v_notification_message, v_admin_id, NEW.id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error creating admin notification: %', SQLERRM;
    END;

    -- Notify DRIVER when job is completed
    IF v_old_status = 'in_progress' AND v_new_status = 'completed' AND v_driver_id IS NOT NULL THEN
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
                    'Job Completed Successfully',
                    format('You have successfully completed the job "%s"', v_job_title),
                    'job_completion',
                    jsonb_build_object(
                        'jobId', NEW.id::text,
                        'jobTitle', v_job_title,
                        'status', 'completed',
                        'adminId', v_admin_id::text,
                        'adminName', COALESCE(v_admin_name, '')
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
                    'Job Completed Successfully',
                    format('You have successfully completed the job "%s"', v_job_title),
                    'job_completion',
                    NOW()
                );
            END IF;

            RAISE NOTICE '✅ Driver notification created: Job Completed Successfully (Driver ID: %, Job ID: %)', 
                v_driver_id, NEW.id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error creating driver notification: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the job update
        RAISE NOTICE '❌ Fatal error in notify_admin_on_job_status_change: % (SQL State: %)', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- ============================================================================
-- 2. UPDATE INVOICE CREATION NOTIFICATION TO INCLUDE DRIVER
-- ============================================================================

-- Drop and recreate the function to notify both admin and driver
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
        RETURN NEW;
    END IF;

    -- Get invoice details
    v_amount := NEW.amount;
    v_invoice_number := NEW.invoice_number;
    v_driver_id := NEW.driver_id;

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
                    'driverId', v_driver_id,
                    'driverName', v_driver_name,
                    'driverEmail', v_driver_email,
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

    -- Notify DRIVER
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
                RAISE NOTICE '❌ Error creating driver invoice notification: %', SQLERRM;
        END;
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

GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admin_on_invoice_creation() TO authenticated;

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
        'job_status_notification_trigger',
        'invoice_creation_notification_trigger'
    );

    -- Check functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_name IN (
        'notify_admin_on_job_status_change',
        'notify_admin_on_invoice_creation'
    )
    AND routine_type = 'FUNCTION';

    IF trigger_count = 2 AND function_count = 2 THEN
        RAISE NOTICE '✅ All triggers and functions created successfully';
        RAISE NOTICE '   - Job completion notifications: Admin + Driver';
        RAISE NOTICE '   - Invoice creation notifications: Admin + Driver';
    ELSE
        RAISE NOTICE '❌ ERROR: Triggers: %, Functions: %', trigger_count, function_count;
    END IF;
END $$;

