-- Drop existing cleanup function
DROP FUNCTION IF EXISTS cleanup_stale_user_statuses;

-- Create updated cleanup function that syncs both tables
CREATE OR REPLACE FUNCTION cleanup_stale_user_statuses()
RETURNS void AS $$
BEGIN
    -- First update user_status table
    UPDATE user_status
    SET online = false
    WHERE online = true
    AND last_seen < CURRENT_TIMESTAMP - INTERVAL '2 minutes';

    -- Then sync the users table
    UPDATE users
    SET 
        online = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE id::text IN (
        SELECT user_id::text
        FROM user_status
        WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '2 minutes'
    );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that runs cleanup when user_status is updated
CREATE OR REPLACE FUNCTION check_and_cleanup_statuses()
RETURNS TRIGGER AS $$
BEGIN
    -- Run cleanup if the update was for online status
    IF TG_OP = 'UPDATE' AND (OLD.online IS DISTINCT FROM NEW.online) THEN
        PERFORM cleanup_stale_user_statuses();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run cleanup when user_status is updated
DROP TRIGGER IF EXISTS trigger_cleanup_on_status_update ON user_status;
CREATE TRIGGER trigger_cleanup_on_status_update
    AFTER UPDATE ON user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION check_and_cleanup_statuses(); 