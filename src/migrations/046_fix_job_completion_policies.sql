-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can create invoices for completed jobs" ON invoices;
DROP POLICY IF EXISTS "Drivers can accept and update jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;

-- Create policy for drivers to update job status to completed
CREATE POLICY "Drivers can complete their jobs" ON jobs
    FOR UPDATE
    TO authenticated
    USING (
        -- User is a driver
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'driver'
        )
        -- Job is assigned to this driver
        AND driver_id = auth.uid()
        -- Job is in progress
        AND status = 'in_progress'
    )
    WITH CHECK (
        -- Only allow updating to completed status
        status = 'completed'
        -- Keep the same driver_id
        AND driver_id = auth.uid()
    );

-- Create policy for drivers to create invoices for completed jobs
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
    ); 