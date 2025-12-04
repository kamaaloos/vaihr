-- Drop existing view and function
DROP VIEW IF EXISTS jobs_with_admin;
DROP FUNCTION IF EXISTS get_jobs_with_admin();

-- Create a security definer function with correct types
CREATE OR REPLACE FUNCTION get_jobs_with_admin()
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    location VARCHAR(255),
    date TIMESTAMP WITH TIME ZONE,
    duration VARCHAR(50),
    rate VARCHAR(50),
    status VARCHAR(50),
    driver_id UUID,
    admin_id UUID,
    driver_name VARCHAR(255),
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    admin_email VARCHAR(255),
    admin_name VARCHAR(255),
    admin_avatar_url VARCHAR(255)
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.*,
        u.email as admin_email,
        u.raw_user_meta_data->>'full_name' as admin_name,
        u.raw_user_meta_data->>'avatar_url' as admin_avatar_url
    FROM 
        jobs j
    LEFT JOIN 
        auth.users u ON j.admin_id = u.id
    WHERE
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
                (j.status = 'open' AND j.driver_id IS NULL)
                OR j.driver_id = auth.uid()
            )
        );
END;
$$;

-- Create the view using the function
CREATE VIEW jobs_with_admin AS
SELECT * FROM get_jobs_with_admin();

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated; 