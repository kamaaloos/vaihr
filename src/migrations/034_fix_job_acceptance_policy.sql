-- Drop the existing policy
DROP POLICY IF EXISTS "Drivers can accept and update jobs" ON jobs;

-- Create a new policy with correct status transition rules
CREATE POLICY "Drivers can accept and update jobs"
ON jobs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND raw_user_meta_data->>'role' = 'driver'
    )
    AND (
        -- Allow drivers to update jobs they're assigned to
        driver_id = auth.uid()
        OR
        -- Allow drivers to accept open jobs
        (status = 'open' AND driver_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND raw_user_meta_data->>'role' = 'driver'
    )
    AND (
        -- Allow updating own jobs with any valid status
        (driver_id = auth.uid() AND status IN ('assigned', 'in_progress', 'completed', 'cancelled'))
        OR
        -- Allow accepting open jobs
        (
            status = 'assigned'
            AND driver_id = auth.uid()
            AND jobs.status = 'open'
            AND jobs.driver_id IS NULL
        )
    )
); 