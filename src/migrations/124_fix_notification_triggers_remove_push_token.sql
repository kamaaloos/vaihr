-- Fix Notification Triggers to Remove push_token References
-- The notifications table doesn't have a push_token column
-- Push tokens should be fetched from users table when sending notifications

-- 1. Fix notify_admin_on_invoice_creation function
DROP FUNCTION IF EXISTS notify_admin_on_invoice_creation() CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_on_invoice_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
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

    -- Set notification content
    v_notification_title := 'Invoice Generated';
    v_notification_message := CASE 
        WHEN v_driver_name IS NOT NULL THEN 
            format('Invoice %s generated for job "%s" completed by %s (€%.2f)', 
                v_invoice_number, v_job_title, v_driver_name, v_amount)
        ELSE 
            format('Invoice %s generated for job "%s" (€%.2f)', 
                v_invoice_number, v_job_title, v_amount)
    END;

    -- Create notification record in database (without push_token - fetch from users table when needed)
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
                'driverId', NEW.driver_id,
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

    -- Log the notification for debugging
    RAISE NOTICE 'Invoice notification created: % - %', v_notification_title, v_notification_message;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the invoice creation
        RAISE NOTICE 'Error creating invoice notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- 2. Fix notify_on_invoice_status_change function
DROP FUNCTION IF EXISTS notify_on_invoice_status_change() CASCADE;

CREATE OR REPLACE FUNCTION notify_on_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_job_title TEXT;
    v_driver_name TEXT;
    v_driver_email TEXT;
    v_amount DECIMAL;
    v_invoice_number TEXT;
    v_old_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    v_old_status := OLD.status;
    v_new_status := NEW.status;

    -- Get invoice and related details
    SELECT 
        i.amount,
        i.invoice_number,
        j.title,
        j.admin_id,
        COALESCE(au.raw_user_meta_data->>'name', au.email) as driver_name,
        au.email as driver_email
    INTO v_amount, v_invoice_number, v_job_title, v_admin_id, v_driver_name, v_driver_email
    FROM invoices i
    JOIN jobs j ON i.job_id = j.id
    LEFT JOIN auth.users au ON i.driver_id = au.id
    WHERE i.id = NEW.id;

    -- Skip if required data not found
    IF v_admin_id IS NULL OR v_job_title IS NULL THEN
        RETURN NEW;
    END IF;

    -- Handle specific status changes
    IF v_old_status = 'pending' AND v_new_status = 'paid' THEN
        -- Notify admin about payment (push token fetched from users table by notification service)
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
                'Payment Received',
                format('Payment received for invoice %s (€%.2f) - Job: %s', 
                    v_invoice_number, v_amount, v_job_title),
                'invoice_payment',
                jsonb_build_object(
                    'invoiceId', NEW.id,
                    'invoiceNumber', v_invoice_number,
                    'jobId', NEW.job_id,
                    'jobTitle', v_job_title,
                    'driverId', NEW.driver_id,
                    'driverName', v_driver_name,
                    'amount', v_amount,
                    'oldStatus', v_old_status,
                    'newStatus', v_new_status
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
                'Payment Received',
                format('Payment received for invoice %s (€%.2f) - Job: %s', 
                    v_invoice_number, v_amount, v_job_title),
                'invoice_payment',
                NOW()
            );
        END IF;

        -- Notify driver about payment (push token fetched from users table by notification service)
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
                NEW.driver_id,
                'Payment Confirmed',
                format('Payment confirmed for invoice %s (€%.2f) - Job: %s', 
                    v_invoice_number, v_amount, v_job_title),
                'invoice_payment',
                jsonb_build_object(
                    'invoiceId', NEW.id,
                    'invoiceNumber', v_invoice_number,
                    'jobId', NEW.job_id,
                    'jobTitle', v_job_title,
                    'amount', v_amount,
                    'oldStatus', v_old_status,
                    'newStatus', v_new_status
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
                NEW.driver_id,
                'Payment Confirmed',
                format('Payment confirmed for invoice %s (€%.2f) - Job: %s', 
                    v_invoice_number, v_amount, v_job_title),
                'invoice_payment',
                NOW()
            );
        END IF;

        RAISE NOTICE 'Payment notifications created for invoice %s', v_invoice_number;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the invoice update
        RAISE NOTICE 'Error creating invoice status notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS invoice_creation_notification_trigger ON invoices;
CREATE TRIGGER invoice_creation_notification_trigger
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_invoice_creation();

DROP TRIGGER IF EXISTS invoice_status_notification_trigger ON invoices;
CREATE TRIGGER invoice_status_notification_trigger
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_invoice_status_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_invoice_creation() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_on_invoice_status_change() TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

