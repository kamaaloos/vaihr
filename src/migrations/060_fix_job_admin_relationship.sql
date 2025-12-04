-- Add foreign key constraint for admin_id in jobs table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
    ) THEN
        ALTER TABLE jobs
        ADD CONSTRAINT jobs_admin_id_fkey
        FOREIGN KEY (admin_id) REFERENCES auth.users(id);
    END IF;
END $$;

-- Recreate the jobs_with_admin view to ensure it's using the correct relationships
DROP VIEW IF EXISTS jobs_with_admin;
CREATE VIEW jobs_with_admin AS
SELECT 
    j.*,
    au.email as admin_email,
    au.raw_user_meta_data->>'name' as admin_name,
    au.raw_user_meta_data->>'avatar_url' as admin_avatar_url,
    au.raw_user_meta_data->>'expo_push_token' as admin_expo_push_token
FROM jobs j
LEFT JOIN auth.users au ON j.admin_id = au.id;

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated;

-- Create a policy for the view
DROP POLICY IF EXISTS "jobs_with_admin_select_policy" ON jobs_with_admin;
CREATE POLICY "jobs_with_admin_select_policy" ON jobs_with_admin
    FOR SELECT
    TO authenticated
    USING (
        -- Allow admins to see all jobs
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'admin'
        )
        OR
        -- Allow drivers to see open jobs and their own jobs
        (
            j.status = 'open'
            OR
            j.driver_id = auth.uid()
        )
    ); 