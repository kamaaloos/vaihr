-- Drop all versions of upsert_user_status using a more robust approach
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all functions named upsert_user_status
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) AS argtypes
        FROM pg_proc 
        WHERE proname = 'upsert_user_status'
    LOOP
        -- Construct and execute dynamic DROP statement
        EXECUTE 'DROP FUNCTION IF EXISTS upsert_user_status(' || func_record.argtypes || ') CASCADE';
    END LOOP;
END $$;

-- Explicitly drop both known versions
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text) CASCADE;
DROP FUNCTION IF EXISTS upsert_user_status(uuid, boolean, text, text) CASCADE;

-- Create version 1: Uses auth.uid() internally
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

-- Create version 2: Takes user_id as a parameter (for admin use)
CREATE OR REPLACE FUNCTION upsert_user_status(
    p_user_id UUID,
    p_is_online BOOLEAN,
    p_platform TEXT,
    p_platform_version TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if user has permission (admin or self)
    IF NOT (
        -- Is admin
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
        -- Or is self
        OR auth.uid() = p_user_id
    ) THEN
        RAISE EXCEPTION 'Permission denied: Only admins can update other users status';
    END IF;

    -- Update the user_status table
    INSERT INTO user_status (
        user_id,
        is_online,
        platform,
        last_seen,
        updated_at
    ) VALUES (
        p_user_id,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_user_status(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_status(uuid, boolean, text, text) TO authenticated;

-- Ensure the function owner has proper permissions
ALTER FUNCTION upsert_user_status(boolean, text, text) OWNER TO postgres;
ALTER FUNCTION upsert_user_status(uuid, boolean, text, text) OWNER TO postgres; 