-- Prevent Duplicate Invoices Migration
-- This migration fixes the complete_job_and_create_invoice function to prevent duplicate invoices

-- Drop the function if it exists
DROP FUNCTION IF EXISTS complete_job_and_create_invoice(jsonb);

-- Create the function with duplicate prevention
CREATE OR REPLACE FUNCTION complete_job_and_create_invoice(params jsonb)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice_id UUID;
    v_existing_invoice_id UUID;
    v_amount DECIMAL(10,2);
    v_admin_id UUID;
    v_job_id UUID;
    v_duration_minutes INTEGER;
    v_rate_per_hour DECIMAL(10,2);
BEGIN
    -- Extract parameters from JSON
    v_job_id := (params->>'job_id')::UUID;
    v_duration_minutes := (params->>'duration_minutes')::INTEGER;
    v_rate_per_hour := (params->>'rate_per_hour')::DECIMAL;

    -- Validate parameters
    IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
        RAISE EXCEPTION 'Invalid duration_minutes: %', v_duration_minutes;
    END IF;

    IF v_rate_per_hour IS NULL OR v_rate_per_hour <= 0 THEN
        RAISE EXCEPTION 'Invalid rate_per_hour: %', v_rate_per_hour;
    END IF;

    -- Get the admin_id from the job
    SELECT admin_id INTO v_admin_id
    FROM jobs
    WHERE id = v_job_id
    AND driver_id = auth.uid()
    AND status = 'in_progress';

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Job not found or not in progress';
    END IF;

    -- Check if an invoice already exists for this job
    SELECT id INTO v_existing_invoice_id
    FROM invoices
    WHERE job_id = v_job_id
    LIMIT 1;

    -- If invoice already exists, return the existing invoice ID
    IF v_existing_invoice_id IS NOT NULL THEN
        RAISE NOTICE 'Invoice already exists for job %: returning existing invoice %', v_job_id, v_existing_invoice_id;
        RETURN v_existing_invoice_id;
    END IF;

    -- Calculate the amount with proper decimal handling
    v_amount := ROUND((v_duration_minutes::DECIMAL / 60) * v_rate_per_hour, 2);

    -- Validate the calculated amount
    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid calculated amount: %', v_amount;
    END IF;

    -- Start a transaction
    BEGIN
        -- Update the job status
        UPDATE jobs
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = v_job_id
        AND driver_id = auth.uid()
        AND status = 'in_progress';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Failed to update job status';
        END IF;

        -- Create the invoice (only if it doesn't exist)
        INSERT INTO invoices (
            job_id,
            driver_id,
            admin_id,
            amount,
            status,
            created_at,
            updated_at
        )
        VALUES (
            v_job_id,
            auth.uid(),
            v_admin_id,
            v_amount,
            'pending',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_invoice_id;

        IF v_invoice_id IS NULL THEN
            RAISE EXCEPTION 'Failed to create invoice';
        END IF;

        RETURN v_invoice_id;
    END;
EXCEPTION
    WHEN unique_violation THEN
        -- If a unique constraint violation occurs, try to get the existing invoice
        SELECT id INTO v_existing_invoice_id
        FROM invoices
        WHERE job_id = v_job_id
        LIMIT 1;
        
        IF v_existing_invoice_id IS NOT NULL THEN
            RAISE NOTICE 'Invoice was created concurrently, returning existing invoice %', v_existing_invoice_id;
            RETURN v_existing_invoice_id;
        ELSE
            RAISE;
        END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_job_and_create_invoice(jsonb) TO authenticated;

-- Optional: Add a unique constraint on job_id to prevent duplicates at the database level
-- Uncomment the following if you want database-level enforcement
-- ALTER TABLE invoices ADD CONSTRAINT unique_job_id UNIQUE (job_id);


