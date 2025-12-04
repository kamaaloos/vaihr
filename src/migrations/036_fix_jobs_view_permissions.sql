-- Drop and recreate the view with proper permissions
DROP VIEW IF EXISTS jobs_with_admin;

CREATE VIEW jobs_with_admin AS
SELECT 
    j.*,  -- All columns from jobs
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    u.raw_user_meta_data->>'avatar_url' as admin_avatar_url
FROM 
    jobs j
LEFT JOIN 
    auth.users u ON j.admin_id = u.id;

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated;

-- Create a policy for the view to ensure it respects RLS
CREATE POLICY "View jobs with admin info"
ON jobs_with_admin
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