-- Fix Invoice Creation Notification for Admin
-- The issue: Admin is not receiving invoice creation notifications
-- This migration ensures admin_id is correctly retrieved and notification is created

-- Drop and recreate the function with better admin_id handling
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

    -- CRITICAL FIX: Get admin_id directly from NEW (invoice already has it)
    -- This is more reliable than querying the job table
    v_admin_id := NEW.admin_id;
    v_driver_id := NEW.driver_id;

    -- If admin_id is not in invoice, get it from job (fallback)
    IF v_admin_id IS NULL THEN
        RAISE NOTICE '⚠️ admin_id not in invoice, getting from job...';
        SELECT j.admin_id, j.title
        INTO v_admin_id, v_job_title
        FROM jobs j
        WHERE j.id = NEW.job_id;
    ELSE
        -- Get job title for notification message
        SELECT title INTO v_job_title
        FROM jobs
        WHERE id = NEW.job_id;
    END IF;

    -- Get driver details if driver_id is available
    IF v_driver_id IS NOT NULL THEN
        SELECT 
            COALESCE(au.raw_user_meta_data->>'name', au.email) as driver_name,
            au.email as driver_email
        INTO v_driver_name, v_driver_email
        FROM auth.users au
        WHERE au.id = v_driver_id;
    END IF;

    -- Skip if no admin_id (critical check)
    IF v_admin_id IS NULL THEN
        RAISE NOTICE '❌ CRITICAL: Cannot create admin notification - admin_id is NULL (Invoice ID: %, Job ID: %)', 
            NEW.id, NEW.job_id;
        RETURN NEW;
    END IF;

    -- Get invoice details
    v_amount := NEW.amount;
    v_invoice_number := COALESCE(NEW.invoice_number, 'N/A');

    -- Set notification content for admin
    v_notification_title := 'Invoice Generated';
    v_notification_message := CASE 
        WHEN v_driver_name IS NOT NULL THEN 
            format('Invoice %s generated for job "%s" completed by %s (€%.2f)', 
                v_invoice_number, COALESCE(v_job_title, 'Unknown Job'), v_driver_name, v_amount)
        ELSE 
            format('Invoice %s generated for job "%s" (€%.2f)', 
                v_invoice_number, COALESCE(v_job_title, 'Unknown Job'), v_amount)
    END;

    -- Notify ADMIN (CRITICAL: Must have admin_id)
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
                    'jobTitle', COALESCE(v_job_title, 'Unknown Job'),
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

        RAISE NOTICE '✅ Admin invoice notification created: % - % (Admin ID: %, Invoice ID: %, Job ID: %)', 
            v_notification_title, v_notification_message, v_admin_id, NEW.id, NEW.job_id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ ERROR creating admin invoice notification: % (Admin ID: %, Invoice ID: %)', 
                SQLERRM, v_admin_id, NEW.id;
            -- Log the full error details
            RAISE NOTICE '   SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
    END;

    -- Notify DRIVER (if driver_id is available)
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
                        v_invoice_number, COALESCE(v_job_title, 'Unknown Job'), v_amount),
                    'invoice_creation',
                    jsonb_build_object(
                        'invoiceId', NEW.id,
                        'invoiceNumber', v_invoice_number,
                        'jobId', NEW.job_id,
                        'jobTitle', COALESCE(v_job_title, 'Unknown Job'),
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
                        v_invoice_number, COALESCE(v_job_title, 'Unknown Job'), v_amount),
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
        RAISE NOTICE '❌ FATAL ERROR in notify_admin_on_invoice_creation: % (Invoice ID: %)', SQLERRM, NEW.id;
        RAISE NOTICE '   SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS invoice_creation_notification_trigger ON invoices;
CREATE TRIGGER invoice_creation_notification_trigger
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_invoice_creation();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_invoice_creation() TO authenticated;

-- Verify trigger exists
DO $$ 
DECLARE
    trigger_exists BOOLEAN;
    function_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'invoice_creation_notification_trigger'
        AND event_object_table = 'invoices'
    ) INTO trigger_exists;

    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_name = 'notify_admin_on_invoice_creation'
        AND routine_type = 'FUNCTION'
    ) INTO function_exists;

    IF trigger_exists AND function_exists THEN
        RAISE NOTICE '✅ Invoice creation notification trigger and function are set up correctly';
    ELSE
        RAISE NOTICE '❌ ERROR: Trigger exists: %, Function exists: %', trigger_exists, function_exists;
    END IF;
END $$;

