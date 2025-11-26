-- Drop all versions of the function first
DROP FUNCTION IF EXISTS update_user_push_token(text);
DROP FUNCTION IF EXISTS update_user_push_token(text, text);
DROP FUNCTION IF EXISTS update_user_push_token(uuid, text);
DROP FUNCTION IF EXISTS update_user_push_token(uuid, text, text);

-- Create the new version of the function
CREATE OR REPLACE FUNCTION update_user_push_token(
    p_device_token TEXT,
    p_platform TEXT DEFAULT 'unknown'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_status (user_id, device_token, platform, is_online)
    VALUES (auth.uid(), p_device_token, p_platform, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        device_token = p_device_token,
        platform = p_platform,
        is_online = true,
        last_seen = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_push_token TO authenticated;

-- Ensure the function owner has proper permissions
ALTER FUNCTION update_user_push_token OWNER TO postgres; 