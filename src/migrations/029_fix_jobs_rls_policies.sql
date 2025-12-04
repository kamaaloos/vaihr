-- Enable RLS on jobs table if not already enabled
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS jobs_select_policy ON jobs;
DROP POLICY IF EXISTS jobs_insert_policy ON jobs;
DROP POLICY IF EXISTS jobs_update_policy ON jobs;
DROP POLICY IF EXISTS jobs_delete_policy ON jobs;

-- Create a policy for selecting jobs (anyone can view)
CREATE POLICY jobs_select_policy ON jobs
    FOR SELECT
    USING (true);

-- Create a policy for inserting jobs (authenticated users can create)
CREATE POLICY jobs_insert_policy ON jobs
    FOR INSERT
    WITH CHECK (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a policy for updating jobs (only admin of the job or admin role can update)
CREATE POLICY jobs_update_policy ON jobs
    FOR UPDATE
    USING (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a policy for deleting jobs (only admin of the job or admin role can delete)
CREATE POLICY jobs_delete_policy ON jobs
    FOR DELETE
    USING (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;

-- Make sure the admin_id column has the right foreign key relationship
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
    ) THEN
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_admin_id_fkey 
        FOREIGN KEY (admin_id) 
        REFERENCES auth.users(id);
    END IF;
END $$; 