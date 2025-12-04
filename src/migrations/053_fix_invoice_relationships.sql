-- Drop existing policies
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

-- Drop the debug trigger if it exists
DROP TRIGGER IF EXISTS debug_invoice_insert_trigger ON invoices;
DROP FUNCTION IF EXISTS debug_invoice_insert();

-- Create a simple insert policy
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
        -- Status is 'pending'
        AND status = 'pending'
        -- Amount is positive
        AND amount > 0
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

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_job_id_fkey'
    ) THEN
        ALTER TABLE invoices
        ADD CONSTRAINT invoices_job_id_fkey
        FOREIGN KEY (job_id) REFERENCES jobs(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_driver_id_fkey'
    ) THEN
        ALTER TABLE invoices
        ADD CONSTRAINT invoices_driver_id_fkey
        FOREIGN KEY (driver_id) REFERENCES auth.users(id);
    END IF;
END $$; 