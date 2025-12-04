-- Drop existing view and function
DROP VIEW IF EXISTS public.jobs_with_admin;
DROP FUNCTION IF EXISTS public.get_jobs_with_admin();

-- Create a simple view that joins jobs with admin info without complex RLS
CREATE OR REPLACE VIEW public.jobs_with_admin AS
SELECT 
    j.id::uuid,
    j.title,
    j.description,
    j.location,
    j.date,
    j.duration,
    j.rate,
    j.status,
    j.driver_id::uuid,
    j.admin_id::uuid,
    j.driver_name,
    j.image_url,
    j.created_at,
    j.updated_at,
    auth_users.email::text as admin_email,
    COALESCE(auth_users.raw_user_meta_data->>'name', auth_users.email)::text as admin_name,
    COALESCE(auth_users.raw_user_meta_data->>'avatar_url', '')::text as admin_avatar_url
FROM 
    public.jobs j
LEFT JOIN 
    auth.users auth_users ON j.admin_id::uuid = auth_users.id;

-- Grant necessary permissions
GRANT SELECT ON public.jobs_with_admin TO authenticated;

-- Ensure the jobs table has proper RLS policies
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
CREATE POLICY "jobs_select_policy" ON jobs
    FOR SELECT
    TO authenticated
    USING (
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
    );

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the view exists and has data
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_name = 'jobs_with_admin'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'View jobs_with_admin exists in public schema';
        
        -- Check if there are any completed jobs
        IF EXISTS (
            SELECT 1 FROM public.jobs WHERE status = 'completed'
        ) THEN
            RAISE NOTICE 'Found completed jobs in the jobs table';
        ELSE
            RAISE NOTICE 'No completed jobs found in the jobs table';
        END IF;
        
    ELSE
        RAISE NOTICE 'ERROR: View jobs_with_admin does not exist in public schema';
    END IF;
END $$; 