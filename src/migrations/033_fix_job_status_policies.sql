-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;
DROP POLICY IF EXISTS jobs_update_policy ON jobs;

-- Create a new policy for drivers to accept and update jobs
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
        -- Allow updating own jobs
        driver_id = auth.uid()
        OR
        -- Allow accepting open jobs
        (
            status = 'assigned'
            AND driver_id = auth.uid()
        )
    )
);

-- Update any existing 'new' status to 'open'
UPDATE jobs
SET status = 'open'
WHERE status = 'new';

-- Update any existing 'processing' status to 'in_progress'
UPDATE jobs
SET status = 'in_progress'
WHERE status = 'processing';

-- Add a check constraint to ensure status values are valid
ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')); 