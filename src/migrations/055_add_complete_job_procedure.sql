-- Create a function to complete a job and create an invoice in a single transaction
CREATE OR REPLACE FUNCTION complete_job_and_create_invoice(
    p_job_id UUID,
    p_duration_minutes INTEGER,
    p_rate_per_hour DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_amount DECIMAL;
    v_admin_id UUID;
BEGIN
    -- Get the admin_id from the job
    SELECT admin_id INTO v_admin_id
    FROM jobs
    WHERE id = p_job_id
    AND driver_id = auth.uid()
    AND status = 'in_progress';

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Job not found or not in progress';
    END IF;

    -- Calculate the amount
    v_amount := (p_duration_minutes::DECIMAL / 60) * p_rate_per_hour;

    -- Start a transaction
    BEGIN
        -- Update the job status
        UPDATE jobs
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = p_job_id
        AND driver_id = auth.uid()
        AND status = 'in_progress';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Failed to update job status';
        END IF;

        -- Create the invoice
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
            p_job_id,
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_job_and_create_invoice(UUID, INTEGER, DECIMAL) TO authenticated; 