-- Drop existing function
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);

-- Create updated function that syncs online status between tables
CREATE OR REPLACE FUNCTION upsert_user_status(
    p_is_online BOOLEAN,
    p_platform TEXT
)
RETURNS user_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result user_status;
    v_user_id UUID;
BEGIN
    -- Get the current user's ID
    v_user_id := auth.uid();

    -- Begin transaction
    BEGIN
        -- Update user_status table
        INSERT INTO user_status (
            user_id,
            is_online,
            platform,
            last_seen,
            last_active
        )
        VALUES (
            v_user_id,
            p_is_online,
            p_platform,
            CURRENT_TIMESTAMP,
            CASE WHEN p_is_online THEN CURRENT_TIMESTAMP ELSE NULL END
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            is_online = EXCLUDED.is_online,
            platform = EXCLUDED.platform,
            last_seen = CURRENT_TIMESTAMP,
            last_active = CASE 
                WHEN EXCLUDED.is_online THEN CURRENT_TIMESTAMP 
                ELSE user_status.last_active 
            END
        RETURNING * INTO v_result;

        -- Return the result from user_status
        RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE NOTICE 'Error in upsert_user_status: %', SQLERRM;
        RAISE;
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_user_status TO authenticated;

-- Reset any stale online statuses in user_status table
UPDATE user_status 
SET is_online = false 
WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '2 minutes'; 