-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can accept and update jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;

-- Create a simple policy for drivers to accept jobs
CREATE POLICY "Drivers can accept jobs"
ON jobs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND raw_user_meta_data->>'role' = 'driver'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND raw_user_meta_data->>'role' = 'driver'
    )
    AND (
        -- Allow drivers to update their own jobs
        driver_id = auth.uid()
        OR
        -- Allow accepting open jobs
        (
            status = 'assigned'
            AND driver_id = auth.uid()
        )
    )
); 