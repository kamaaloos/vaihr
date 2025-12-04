-- Create function to update offline status
CREATE OR REPLACE FUNCTION update_offline_status()
RETURNS void AS $$
BEGIN
    UPDATE user_status
    SET is_online = false
    WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to update last_seen and handle timeouts
CREATE OR REPLACE FUNCTION update_user_status_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if this is a system update (from our functions)
    IF current_setting('app.system_update', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Always update last_seen when user is marked as online
    IF NEW.is_online = true THEN
        NEW.last_seen = CURRENT_TIMESTAMP;
    END IF;

    -- If last_seen is more than 5 minutes old, mark as offline
    IF NEW.last_seen < CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN
        NEW.is_online = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_seen
DROP TRIGGER IF EXISTS user_status_last_seen_trigger ON user_status;
CREATE TRIGGER user_status_last_seen_trigger
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_user_status_last_seen();

-- Create trigger to handle batch updates
CREATE OR REPLACE FUNCTION handle_batch_status_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if this is a system update
    IF current_setting('app.system_update', true) = 'true' THEN
        RETURN NULL;
    END IF;

    -- Set the system update flag
    PERFORM set_config('app.system_update', 'true', true);
    
    -- Update offline status for any stale records
    PERFORM update_offline_status();
    
    -- Reset the system update flag
    PERFORM set_config('app.system_update', 'false', true);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run batch updates periodically
DROP TRIGGER IF EXISTS batch_status_update_trigger ON user_status;
CREATE TRIGGER batch_status_update_trigger
    AFTER UPDATE ON user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION handle_batch_status_updates();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_offline_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status_last_seen TO authenticated;
GRANT EXECUTE ON FUNCTION handle_batch_status_updates TO authenticated; 