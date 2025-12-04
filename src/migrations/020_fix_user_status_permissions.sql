-- Grant permissions for the upsert_user_status function to access the users table
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO postgres;

-- Drop all possible versions of the function
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text);
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);
DROP FUNCTION IF EXISTS upsert_user_status(p_is_online boolean, p_platform text);
DROP FUNCTION IF EXISTS upsert_user_status(p_is_online boolean, p_platform text, p_platform_version text);
DROP FUNCTION IF EXISTS upsert_user_status();

-- Create the new function
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
GRANT EXECUTE ON FUNCTION upsert_user_status(boolean, text, text) TO postgres;

-- Ensure RLS is enabled on user_status table
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own status
DROP POLICY IF EXISTS user_status_select_policy ON user_status;
CREATE POLICY user_status_select_policy ON user_status
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to update their own status
DROP POLICY IF EXISTS user_status_update_policy ON user_status;
CREATE POLICY user_status_update_policy ON user_status
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own status
DROP POLICY IF EXISTS user_status_insert_policy ON user_status;
CREATE POLICY user_status_insert_policy ON user_status
    FOR INSERT
    WITH CHECK (auth.uid() = user_id); 