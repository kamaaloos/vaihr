-- Create function to reset stale statuses
CREATE OR REPLACE FUNCTION reset_stale_statuses()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.system_update', 'true', true);
    UPDATE user_status SET is_online = false WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '2 minutes';
    PERFORM set_config('app.system_update', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the reset
SELECT reset_stale_statuses();

-- Drop the temporary function
DROP FUNCTION reset_stale_statuses();

-- Drop the existing upsert function before recreating it
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);

-- Modify the upsert_user_status function to handle timeouts
CREATE OR REPLACE FUNCTION upsert_user_status(
    p_is_online BOOLEAN,
    p_platform TEXT,
    p_platform_version TEXT
)
RETURNS user_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result user_status;
BEGIN
    -- Set the system update flag to prevent trigger recursion
    PERFORM set_config('app.system_update', 'true', true);

    -- If the user is being marked as online, update last_seen
    IF p_is_online THEN
        INSERT INTO user_status (
            user_id,
            is_online,
            platform,
            platform_version,
            last_seen,
            last_active
        )
        VALUES (
            auth.uid(),
            true,
            p_platform,
            p_platform_version,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            is_online = true,
            platform = EXCLUDED.platform,
            platform_version = EXCLUDED.platform_version,
            last_seen = CURRENT_TIMESTAMP,
            last_active = CURRENT_TIMESTAMP
        RETURNING * INTO v_result;
    ELSE
        -- If marking offline, just update the online status
        UPDATE user_status
        SET 
            is_online = false,
            last_seen = CURRENT_TIMESTAMP
        WHERE user_id = auth.uid()
        RETURNING * INTO v_result;
    END IF;

    -- Reset the system update flag
    PERFORM set_config('app.system_update', 'false', true);

    RETURN v_result;
END;
$$; 