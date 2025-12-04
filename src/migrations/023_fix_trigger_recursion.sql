-- Drop existing triggers that are causing recursion
DROP TRIGGER IF EXISTS batch_status_update_trigger ON user_status;
DROP TRIGGER IF EXISTS trigger_cleanup_on_status_update ON user_status;

-- Drop the functions
DROP FUNCTION IF EXISTS handle_batch_status_updates() CASCADE;
DROP FUNCTION IF EXISTS check_and_cleanup_statuses() CASCADE;

-- Create a single function to handle status updates with recursion prevention
CREATE OR REPLACE FUNCTION handle_status_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Prevent recursive triggering by checking if this is a cleanup update
    IF (TG_OP = 'UPDATE' AND NEW.is_online = false AND OLD.is_online = true) THEN
        -- This is a cleanup update, don't trigger again
        RETURN NEW;
    END IF;

    -- Only proceed if this is not already a cleanup operation
    IF (TG_OP = 'UPDATE' AND NEW.is_online = true) THEN
        -- Check if the user has been offline for too long
        IF (OLD.last_seen IS NOT NULL AND 
            (EXTRACT(EPOCH FROM (NOW() - OLD.last_seen)) > 300)) THEN
            -- Mark as offline without triggering another update
            NEW.is_online := false;
            NEW.updated_at := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create a single trigger that runs BEFORE UPDATE
CREATE TRIGGER user_status_update_trigger
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION handle_status_updates();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_status_updates() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_status_updates() TO postgres;

-- Create a function for periodic cleanup (to be called by application logic, not a trigger)
CREATE OR REPLACE FUNCTION cleanup_stale_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_status
    SET is_online = false,
        updated_at = NOW()
    WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Grant execute permissions for the cleanup function
GRANT EXECUTE ON FUNCTION cleanup_stale_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_statuses() TO postgres; 