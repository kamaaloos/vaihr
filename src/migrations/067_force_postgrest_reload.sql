-- First, ensure the foreign key constraint exists in the public schema
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
        AND table_schema = 'public'
    ) THEN
        -- Add foreign key constraint for admin_id in jobs table
        ALTER TABLE public.jobs
        ADD CONSTRAINT jobs_admin_id_fkey
        FOREIGN KEY (admin_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Create an index on admin_id for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_admin_id ON public.jobs(admin_id);

-- Grant necessary permissions
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

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