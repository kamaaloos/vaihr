-- Drop existing view and function
DROP VIEW IF EXISTS jobs_with_admin;
DROP FUNCTION IF EXISTS get_jobs_with_admin();

-- Create a simple view that joins jobs with admin info
CREATE VIEW jobs_with_admin AS
SELECT 
    j.id,
    j.title,
    j.description,
    j.status,
    j.driver_id,
    j.admin_id,
    u.raw_user_meta_data->>'full_name' as admin_name,
    u.raw_user_meta_data->>'avatar_url' as admin_avatar_url,
    j.location as pickup_location,
    j.location as delivery_location,
    j.date::text as pickup_date,
    j.date::text as delivery_date,
    j.created_at,
    j.updated_at,
    j.location,
    j.date,
    j.duration,
    j.rate,
    j.driver_name,
    j.image_url,
    u.email as admin_email
FROM 
    jobs j
LEFT JOIN 
    auth.users u ON j.admin_id = u.id;

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated;

-- Drop existing policies on jobs table
DROP POLICY IF EXISTS "Admins can see all jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers see new jobs and their own jobs" ON jobs;
DROP POLICY IF EXISTS jobs_select_policy ON jobs;

-- Create a comprehensive policy for selecting jobs
CREATE POLICY "Comprehensive jobs select policy" ON jobs
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