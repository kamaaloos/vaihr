-- First, ensure the invoices table has all required columns
DO $$ 
BEGIN
    -- Add admin_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'admin_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN admin_id UUID REFERENCES auth.users(id);
    END IF;

    -- Add created_at and updated_at columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE invoices ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

-- Create a simplified insert policy
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
        -- Admin ID matches the job's admin_id
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.admin_id = invoices.admin_id
        )
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

-- Create a trigger to automatically set updated_at
CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_timestamp_trigger ON invoices;
CREATE TRIGGER update_invoice_timestamp_trigger
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_timestamp(); 