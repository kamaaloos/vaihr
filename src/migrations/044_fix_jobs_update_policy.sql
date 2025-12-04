-- Drop existing update policy
DROP POLICY IF EXISTS jobs_update_policy ON jobs;

-- Create a fixed policy for updating jobs
CREATE POLICY "jobs_update_policy" ON jobs
    FOR UPDATE
    TO authenticated
    USING (
        -- Allow admins to update any job
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to update jobs where they are the admin
        admin_id = auth.uid()
        OR
        -- Allow drivers to update jobs they are assigned to
        (
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE auth.users.id = auth.uid()
                AND raw_user_meta_data->>'role' = 'driver'
            )
            AND (
                -- Allow drivers to accept open jobs
                (jobs.status = 'open' AND jobs.driver_id IS NULL)
                OR
                -- Allow drivers to update their own jobs
                driver_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        -- Allow admins to update any job
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to update jobs where they are the admin
        admin_id = auth.uid()
        OR
        -- Allow drivers to update jobs they are assigned to
        (
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE auth.users.id = auth.uid()
                AND raw_user_meta_data->>'role' = 'driver'
            )
            AND (
                -- Allow drivers to accept open jobs
                (jobs.status = 'open' AND jobs.driver_id IS NULL AND status = 'assigned' AND driver_id = auth.uid())
                OR
                -- Allow drivers to update their own jobs with valid status transitions
                (
                    driver_id = auth.uid()
                    AND (
                        -- Allow status transitions for driver's own jobs
                        (jobs.status = 'assigned' AND status = 'in_progress')
                        OR
                        (jobs.status = 'in_progress' AND status = 'completed')
                        OR
                        (jobs.status = 'assigned' AND status = 'cancelled')
                    )
                )
            )
        )
    ); 