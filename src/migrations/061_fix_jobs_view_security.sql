-- Drop the existing view and policy
DROP POLICY IF EXISTS "jobs_with_admin_select_policy" ON jobs_with_admin;
DROP VIEW IF EXISTS jobs_with_admin;

-- Create a security definer function to get jobs with admin info
CREATE OR REPLACE FUNCTION get_jobs_with_admin()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    location TEXT,
    date TIMESTAMP WITH TIME ZONE,
    duration TEXT,
    duration_minutes INTEGER,
    rate TEXT,
    rate_per_hour DECIMAL(10,2),
    status TEXT,
    driver_id UUID,
    driver_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    admin_id UUID,
    image_url TEXT,
    admin_email TEXT,
    admin_name TEXT,
    admin_avatar_url TEXT,
    admin_expo_push_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        j.description,
        j.location,
        j.date,
        j.duration,
        j.duration_minutes,
        j.rate,
        j.rate_per_hour,
        j.status,
        j.driver_id,
        j.driver_name,
        j.created_at,
        j.updated_at,
        j.admin_id,
        j.image_url,
        au.email as admin_email,
        au.raw_user_meta_data->>'name' as admin_name,
        au.raw_user_meta_data->>'avatar_url' as admin_avatar_url,
        au.raw_user_meta_data->>'expo_push_token' as admin_expo_push_token
    FROM jobs j
    LEFT JOIN auth.users au ON j.admin_id = au.id
    WHERE 
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
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_jobs_with_admin() TO authenticated; 