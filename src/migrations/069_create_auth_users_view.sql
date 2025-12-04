-- Drop existing view if it exists
DROP VIEW IF EXISTS public.auth_users;

-- Create a view of auth.users in the public schema
CREATE VIEW public.auth_users AS
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
FROM auth.users;

-- Grant necessary permissions
GRANT SELECT ON public.auth_users TO authenticated;

-- Drop and recreate the foreign key constraint to reference the view
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.jobs
        DROP CONSTRAINT jobs_admin_id_fkey;
    END IF;
END $$;

-- Add foreign key constraint referencing the view
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES public.auth_users(id)
ON DELETE SET NULL;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the foreign key relationship
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Foreign key constraint jobs_admin_id_fkey exists in public schema';
    ELSE
        RAISE NOTICE 'ERROR: Foreign key constraint jobs_admin_id_fkey does not exist in public schema';
    END IF;
END $$; 