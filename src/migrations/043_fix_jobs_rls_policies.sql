-- Drop existing policies on jobs table
DROP POLICY IF EXISTS "Admins can see all jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers see new jobs and their own jobs" ON jobs;
DROP POLICY IF EXISTS jobs_select_policy ON jobs;
DROP POLICY IF EXISTS jobs_insert_policy ON jobs;
DROP POLICY IF EXISTS jobs_update_policy ON jobs;
DROP POLICY IF EXISTS jobs_delete_policy ON jobs;
DROP POLICY IF EXISTS "Comprehensive jobs select policy" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept and update jobs" ON jobs;

-- Create a comprehensive policy for selecting jobs
CREATE POLICY "jobs_select_policy" ON jobs
    FOR SELECT
    TO authenticated
    USING (
        -- Allow admins to see all jobs
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow drivers to see open jobs and their own jobs
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'driver'
            AND (
                (jobs.status = 'open' AND jobs.driver_id IS NULL)
                OR jobs.driver_id = auth.uid()
            )
        )
    );

-- Create a policy for inserting jobs
CREATE POLICY "jobs_insert_policy" ON jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow admins to create jobs
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to create jobs where they are the admin
        admin_id = auth.uid()
    );

-- Create a policy for updating jobs
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
                (OLD.status = 'open' AND OLD.driver_id IS NULL AND NEW.status = 'assigned' AND NEW.driver_id = auth.uid())
                OR
                -- Allow drivers to update their own jobs with valid status transitions
                (
                    driver_id = auth.uid()
                    AND (
                        -- Allow status transitions for driver's own jobs
                        (OLD.status = 'assigned' AND NEW.status = 'in_progress')
                        OR
                        (OLD.status = 'in_progress' AND NEW.status = 'completed')
                        OR
                        (OLD.status = 'assigned' AND NEW.status = 'cancelled')
                    )
                )
            )
        )
    );

-- Create a policy for deleting jobs
CREATE POLICY "jobs_delete_policy" ON jobs
    FOR DELETE
    TO authenticated
    USING (
        -- Allow admins to delete any job
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow users to delete jobs where they are the admin
        admin_id = auth.uid()
    );

-- Make sure RLS is enabled on the jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY; 