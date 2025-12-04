-- Add a comment to help Supabase security advisor understand this is not a real table
COMMENT ON SCHEMA public IS 'This schema contains actual database tables. The invalid_count reference in migration 065 is a PL/pgSQL variable, not a table.';

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 