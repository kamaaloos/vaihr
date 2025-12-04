-- Drop all existing policies on jobs table
DROP POLICY IF EXISTS "Admins can see all jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers see new jobs and their own jobs" ON jobs;
DROP POLICY IF EXISTS jobs_select_policy ON jobs;
DROP POLICY IF EXISTS jobs_insert_policy ON jobs;
DROP POLICY IF EXISTS jobs_update_policy ON jobs;
DROP POLICY IF EXISTS jobs_delete_policy ON jobs;
DROP POLICY IF EXISTS "Comprehensive jobs select policy" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept and update jobs" ON jobs;

-- Make sure RLS is enabled on the jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create a simple select policy
CREATE POLICY "jobs_select_policy" ON jobs
    FOR SELECT
    TO authenticated
    USING (true);

-- Create a simple insert policy
CREATE POLICY "jobs_insert_policy" ON jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create a simple update policy
CREATE POLICY "jobs_update_policy" ON jobs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create a simple delete policy
CREATE POLICY "jobs_delete_policy" ON jobs
    FOR DELETE
    TO authenticated
    USING (true); 