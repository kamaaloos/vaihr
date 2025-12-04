-- Drop existing view and function
DROP VIEW IF EXISTS jobs_with_admin;
DROP FUNCTION IF EXISTS get_jobs_with_admin();

-- Create a security definer function with correct types
CREATE OR REPLACE FUNCTION get_jobs_with_admin()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    driver_id UUID,
    admin_id UUID,
    admin_name TEXT,
    admin_avatar_url TEXT,
    pickup_location TEXT,
    delivery_location TEXT,
    pickup_date TEXT,
    delivery_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    location TEXT,
    date TIMESTAMP WITH TIME ZONE,
    duration TEXT,
    rate TEXT,
    driver_name TEXT,
    image_url TEXT,
    admin_email VARCHAR(255)
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
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