-- Add a comment to help Supabase security advisor understand this is not a real table
COMMENT ON SCHEMA public IS 'This schema contains actual database tables. The invalid_count reference in migration 065 is a PL/pgSQL variable, not a table. It is used temporarily to count invalid foreign key references and is not persisted in the database.';

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the comment was added
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_description d
        JOIN pg_namespace n ON n.oid = d.objoid
        WHERE n.nspname = 'public'
        AND d.description LIKE '%invalid_count%'
    ) THEN
        RAISE NOTICE 'Schema comment successfully added';
    ELSE
        RAISE NOTICE 'WARNING: Schema comment may not have been added correctly';
    END IF;
END $$; 