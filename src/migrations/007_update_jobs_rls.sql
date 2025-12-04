-- Drop existing policy
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;

-- Create updated policy for drivers to accept jobs
CREATE POLICY "Drivers can accept new jobs"
ON jobs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()::uuid
        AND auth.users.role = 'driver'
        AND (
            -- Allow drivers to update jobs they're assigned to
            jobs.driver_id = auth.uid()::uuid
            OR
            -- Allow drivers to accept new jobs
            (jobs.status = 'new' AND jobs.driver_id IS NULL)
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()::uuid
        AND auth.users.role = 'driver'
    )
    AND (
        -- Allow updating own jobs
        driver_id = auth.uid()::uuid
        OR
        -- Allow accepting new jobs (status must be 'new' in the policy USING clause)
        (
            status = 'processing' 
            AND driver_id = auth.uid()::uuid
        )
    )
); 