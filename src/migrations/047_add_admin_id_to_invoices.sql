-- Add admin_id column to invoices table
ALTER TABLE invoices
ADD COLUMN admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing invoices to set admin_id from the associated job
UPDATE invoices i
SET admin_id = j.admin_id
FROM jobs j
WHERE i.job_id = j.id;

-- Make admin_id column NOT NULL after updating existing records
ALTER TABLE invoices
ALTER COLUMN admin_id SET NOT NULL;

-- Add index for admin_id
CREATE INDEX idx_invoices_admin_id ON invoices(admin_id);

-- Update the invoice creation policy to include admin_id
DROP POLICY IF EXISTS "Drivers can create invoices for completed jobs" ON invoices;

CREATE POLICY "Drivers can create invoices for completed jobs" ON invoices
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
        -- Referenced job exists and is completed
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.status = 'completed'
            AND jobs.driver_id = auth.uid()
        )
        -- Admin ID is set from the job
        AND EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.admin_id = admin_id
        )
    ); 