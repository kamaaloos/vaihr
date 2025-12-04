-- Drop existing view and function
DROP VIEW IF EXISTS public.jobs_with_admin;
DROP FUNCTION IF EXISTS public.get_jobs_with_admin();

-- Create a function without SECURITY DEFINER to get jobs with admin info
CREATE OR REPLACE FUNCTION public.get_jobs_with_admin(status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    location TEXT,
    date TIMESTAMP WITH TIME ZONE,
    duration TEXT,
    rate TEXT,
    status TEXT,
    driver_id UUID,
    admin_id UUID,
    driver_name TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    admin_email TEXT,
    admin_name TEXT,
    admin_avatar_url TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jobs.id::uuid,
        jobs.title,
        jobs.description,
        jobs.location,
        jobs.date,
        jobs.duration,
        jobs.rate,
        jobs.status,
        jobs.driver_id::uuid,
        jobs.admin_id::uuid,
        jobs.driver_name,
        jobs.image_url,
        jobs.created_at,
        jobs.updated_at,
        auth_users.email::text as admin_email,
        COALESCE(auth_users.raw_user_meta_data->>'name', auth_users.email)::text as admin_name,
        COALESCE(auth_users.raw_user_meta_data->>'avatar_url', '')::text as admin_avatar_url
    FROM 
        public.jobs
    LEFT JOIN 
        auth.users auth_users ON jobs.admin_id::uuid = auth_users.id
    WHERE
        -- Apply RLS policies
        (
            -- Allow admins to see all jobs
            EXISTS (
                SELECT 1 FROM auth.users au
                WHERE au.id = auth.uid()
                AND au.raw_user_meta_data->>'role' = 'admin'
            )
            OR
            -- Allow drivers to see open jobs and their own jobs
            (
                jobs.status = 'open'
                OR
                jobs.driver_id = auth.uid()
            )
        )
        AND
        -- Apply status filter if provided
        (status_filter IS NULL OR status_filter = 'all' OR jobs.status = status_filter);
END;
$$;

-- Create the view using the function with explicit SECURITY INVOKER
CREATE OR REPLACE VIEW public.jobs_with_admin
WITH (security_invoker = true)
AS
SELECT * FROM public.get_jobs_with_admin();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_jobs_with_admin(TEXT) TO authenticated;
GRANT SELECT ON public.jobs_with_admin TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the view exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_name = 'jobs_with_admin'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'View jobs_with_admin exists in public schema';
        
        -- Verify permissions
        IF EXISTS (
            SELECT 1
            FROM information_schema.role_table_grants
            WHERE table_schema = 'public'
            AND table_name = 'jobs_with_admin'
            AND grantee = 'authenticated'
            AND privilege_type = 'SELECT'
        ) THEN
            RAISE NOTICE 'View jobs_with_admin has correct SELECT permissions for authenticated users';
        ELSE
            RAISE NOTICE 'WARNING: View jobs_with_admin may not have correct SELECT permissions';
        END IF;
    ELSE
        RAISE NOTICE 'ERROR: View jobs_with_admin does not exist in public schema';
    END IF;
END $$; 