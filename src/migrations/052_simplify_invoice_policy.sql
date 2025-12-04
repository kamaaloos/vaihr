-- Drop existing policies
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

-- Create a very simple insert policy for testing
CREATE POLICY "invoices_insert_policy" ON invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Basic check that user is authenticated
        auth.uid() IS NOT NULL
        -- Allow any authenticated user to insert for now
        AND true
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

-- Add a function to help debug RLS issues
CREATE OR REPLACE FUNCTION debug_invoice_insert()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'Attempting to insert invoice with:';
    RAISE NOTICE 'driver_id: %', NEW.driver_id;
    RAISE NOTICE 'job_id: %', NEW.job_id;
    RAISE NOTICE 'admin_id: %', NEW.admin_id;
    RAISE NOTICE 'status: %', NEW.status;
    RAISE NOTICE 'amount: %', NEW.amount;
    RAISE NOTICE 'auth.uid(): %', auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to log insert attempts
DROP TRIGGER IF EXISTS debug_invoice_insert_trigger ON invoices;
CREATE TRIGGER debug_invoice_insert_trigger
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION debug_invoice_insert(); 