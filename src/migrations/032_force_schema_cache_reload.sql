-- Ensure the foreign key constraints exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_admin_id_fkey'
    ) THEN
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_admin_id_fkey 
        FOREIGN KEY (admin_id) 
        REFERENCES auth.users(id);
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'driver_id'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_driver_id_fkey'
    ) THEN
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_driver_id_fkey 
        FOREIGN KEY (driver_id) 
        REFERENCES auth.users(id);
    END IF;
END $$;

-- Drop existing functions first
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);
DROP FUNCTION IF EXISTS upsert_user_status(uuid, boolean, text, text);

-- Update the upsert_user_status function to handle p_is_online parameter
CREATE OR REPLACE FUNCTION upsert_user_status(
    p_is_online BOOLEAN,
    p_platform TEXT,
    p_platform_version TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID from the auth context
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Update the user_status table
    INSERT INTO user_status (
        user_id,
        is_online,
        platform,
        last_seen,
        updated_at
    ) VALUES (
        v_user_id,
        p_is_online,
        p_platform,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        is_online = EXCLUDED.is_online,
        platform = EXCLUDED.platform,
        last_seen = EXCLUDED.last_seen,
        updated_at = EXCLUDED.updated_at;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in upsert_user_status: %', SQLERRM;
        RAISE;
END;
$$;

-- Create a separate function for the old parameter name
CREATE OR REPLACE FUNCTION upsert_user_status_compat(
    p_online BOOLEAN,
    p_platform TEXT,
    p_platform_version TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call the main function with the correct parameter name
    PERFORM upsert_user_status(p_online, p_platform, p_platform_version);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_user_status(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_status_compat(boolean, text, text) TO authenticated;

-- Turn on trace level logging temporarily to force schema cache reload
ALTER DATABASE postgres SET log_statement = 'all';
ALTER DATABASE postgres SET log_statement = 'none';

-- Force a more aggressive schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_sleep(1); -- Wait a moment
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_sleep(1); -- Wait a moment
SELECT pg_notify('pgrst', 'reload schema'); 