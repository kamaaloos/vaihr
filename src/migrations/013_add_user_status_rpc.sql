-- Drop all possible versions of the function
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text);
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);
DROP FUNCTION IF EXISTS upsert_user_status(p_is_online boolean, p_platform text);
DROP FUNCTION IF EXISTS upsert_user_status(p_is_online boolean, p_platform text, p_platform_version text);
DROP FUNCTION IF EXISTS upsert_user_status(p_online boolean, p_platform text, p_platform_version text);
DROP FUNCTION IF EXISTS upsert_user_status();

-- Create the function with proper permissions and error handling
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION upsert_user_status(boolean, text, text) TO authenticated;

-- Ensure the function owner has proper permissions
ALTER FUNCTION upsert_user_status OWNER TO postgres; 