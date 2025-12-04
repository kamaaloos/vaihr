-- Drop all existing status-related triggers
DROP TRIGGER IF EXISTS user_status_update_trigger ON user_status;
DROP TRIGGER IF EXISTS user_status_timeout_trigger ON user_status;
DROP TRIGGER IF EXISTS user_status_last_seen_trigger ON user_status;
DROP TRIGGER IF EXISTS batch_status_update_trigger ON user_status;
DROP TRIGGER IF EXISTS trigger_cleanup_on_status_update ON user_status;
DROP TRIGGER IF EXISTS cleanup_stale_statuses_trigger ON user_status;

-- Drop all existing status-related functions
DROP FUNCTION IF EXISTS check_user_status_timeout() CASCADE;
DROP FUNCTION IF EXISTS update_user_status_last_seen() CASCADE;
DROP FUNCTION IF EXISTS handle_batch_status_updates() CASCADE;
DROP FUNCTION IF EXISTS check_and_cleanup_statuses() CASCADE;
DROP FUNCTION IF EXISTS cleanup_stale_statuses() CASCADE;
DROP FUNCTION IF EXISTS trigger_cleanup_stale_statuses() CASCADE;
DROP FUNCTION IF EXISTS reset_stale_statuses() CASCADE;

-- Create function to handle batch updates
CREATE OR REPLACE FUNCTION handle_batch_status_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark users as offline if they haven't been seen in the last 5 minutes
    UPDATE user_status
    SET is_online = false,
        updated_at = NOW()
    WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '5 minutes';

    RETURN NULL;
END;
$$;

-- Create trigger for batch updates
CREATE TRIGGER batch_status_update_trigger
    AFTER UPDATE ON user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION handle_batch_status_updates();

-- Create function to handle cleanup
CREATE OR REPLACE FUNCTION check_and_cleanup_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark users as offline if they haven't been seen in the last 5 minutes
    UPDATE user_status
    SET is_online = false,
        updated_at = NOW()
    WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '5 minutes';

    RETURN NULL;
END;
$$;

-- Create trigger for cleanup
CREATE TRIGGER trigger_cleanup_on_status_update
    AFTER UPDATE ON user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION check_and_cleanup_statuses();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_batch_status_updates() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_batch_status_updates() TO postgres;
GRANT EXECUTE ON FUNCTION check_and_cleanup_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_cleanup_statuses() TO postgres; 