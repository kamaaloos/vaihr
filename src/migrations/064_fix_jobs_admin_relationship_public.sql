-- Drop existing foreign key constraint if it exists
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

-- Add foreign key constraint for admin_id in jobs table
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- Create an index on admin_id for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_admin_id ON public.jobs(admin_id);

-- Grant necessary permissions
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT ON auth.users TO authenticated; 