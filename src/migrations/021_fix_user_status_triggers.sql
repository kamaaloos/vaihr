-- Drop existing triggers
DROP TRIGGER IF EXISTS user_status_update_trigger ON user_status;
DROP TRIGGER IF EXISTS user_status_timeout_trigger ON user_status;
DROP TRIGGER IF EXISTS user_status_last_seen_trigger ON user_status;
DROP TRIGGER IF EXISTS batch_status_update_trigger ON user_status;

-- Drop existing trigger functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS check_user_status_timeout() CASCADE;
DROP FUNCTION IF EXISTS update_user_status_last_seen() CASCADE;
DROP FUNCTION IF EXISTS handle_batch_status_updates() CASCADE;

-- Create trigger function for last seen updates
CREATE OR REPLACE FUNCTION update_user_status_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only update last_seen when is_online is true
    IF NEW.is_online = true THEN
        NEW.last_seen := NOW();
    END IF;

    -- Check if user has been offline for too long
    IF NEW.is_online = true AND 
       OLD.last_seen IS NOT NULL AND 
       (EXTRACT(EPOCH FROM (NOW() - OLD.last_seen)) > 300) THEN
        NEW.is_online := false;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for last seen updates
CREATE TRIGGER user_status_last_seen_trigger
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_user_status_last_seen();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_status_last_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status_last_seen() TO postgres; 