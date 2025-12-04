-- Allow unauthenticated users (anon) to read terms so registration can display existing content

-- Grant SELECT on table to anon role
GRANT SELECT ON public.terms TO anon;

-- Add RLS policy for anon to view terms if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'terms' AND policyname = 'Anonymous users can view terms'
    ) THEN
        CREATE POLICY "Anonymous users can view terms"
            ON public.terms FOR SELECT
            TO anon
            USING (true);
    END IF;
END$$;

-- Ensure authenticated users can read as well (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'terms' AND policyname = 'Authenticated users can view terms'
    ) THEN
        CREATE POLICY "Authenticated users can view terms"
            ON public.terms FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END$$;

-- Ask PostgREST to reload schema/policy cache
NOTIFY pgrst, 'reload schema';


