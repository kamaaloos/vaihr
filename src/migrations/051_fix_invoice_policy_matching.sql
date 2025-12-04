-- Drop existing policies
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

-- Create a simple insert policy that matches exactly what we send in handleCompleteJob
CREATE POLICY "invoices_insert_policy" ON invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User is a driver
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'driver'
        )
        -- Driver ID matches the current user ID
        AND driver_id = auth.uid()
        -- Job exists and is completed
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.status = 'completed'
            AND jobs.driver_id = auth.uid()
        )
        -- Admin ID matches the job's admin_id
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.admin_id = admin_id
        )
        -- Status is 'pending'
        AND status = 'pending'
        -- Amount is positive
        AND amount > 0
        -- Timestamps are set
        AND created_at IS NOT NULL
        AND updated_at IS NOT NULL
    );

-- Create a simple select policy
CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT
    TO authenticated
    USING (
        -- Allow drivers to see their own invoices
        driver_id = auth.uid()
        OR
        -- Allow admins to see all invoices
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a simple update policy
CREATE POLICY "invoices_update_policy" ON invoices
    FOR UPDATE
    TO authenticated
    USING (
        -- Allow admins to update any invoice
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow drivers to update their own invoices
        driver_id = auth.uid()
    )
    WITH CHECK (
        -- Allow admins to update any invoice
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow drivers to update their own invoices
        driver_id = auth.uid()
    ); 