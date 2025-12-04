-- Check if the foreign key constraint exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Foreign key constraint jobs_admin_id_fkey does not exist. Creating it...';
        
        -- Add foreign key constraint for admin_id in jobs table
        ALTER TABLE public.jobs
        ADD CONSTRAINT jobs_admin_id_fkey
        FOREIGN KEY (admin_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    ELSE
        RAISE NOTICE 'Foreign key constraint jobs_admin_id_fkey exists.';
    END IF;
END $$;

-- Check if the index exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_jobs_admin_id'
        AND schemaname = 'public'
    ) THEN
        RAISE NOTICE 'Index idx_jobs_admin_id does not exist. Creating it...';
        
        -- Create an index on admin_id for better performance
        CREATE INDEX idx_jobs_admin_id ON public.jobs(admin_id);
    ELSE
        RAISE NOTICE 'Index idx_jobs_admin_id exists.';
    END IF;
END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 