-- Migration: Fix Online Status Triggers
-- This migration creates proper triggers to handle online status during authentication

-- Create comprehensive function to handle both login and logout
CREATE OR REPLACE FUNCTION sync_online_status_comprehensive()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle login (online = true)
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        UPDATE users 
        SET online = true
        WHERE id = NEW.user_id::text;
        
        RAISE NOTICE 'User % logged in - set online = true', NEW.user_id;
    END IF;
    
    -- Handle logout (online = false)
    IF NEW.is_online = false AND OLD.is_online = true THEN
        UPDATE users 
        SET online = false
        WHERE id = NEW.user_id::text;
        
        RAISE NOTICE 'User % logged out - set online = false', NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT on user_status (new user connection)
CREATE OR REPLACE FUNCTION handle_new_user_connection()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new user_status record is created with is_online = true
    IF NEW.is_online = true THEN
        UPDATE users 
        SET online = true
        WHERE id = NEW.user_id::text;
        
        RAISE NOTICE 'New user connection: % - set online = true', NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_status table for comprehensive sync
DROP TRIGGER IF EXISTS sync_online_status_comprehensive_trigger ON user_status;
CREATE TRIGGER sync_online_status_comprehensive_trigger
    AFTER UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status_comprehensive();

-- Create trigger for new user connections
DROP TRIGGER IF EXISTS new_user_connection_trigger ON user_status;
CREATE TRIGGER new_user_connection_trigger
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_connection();

-- Create a function to manually sync all users (for cleanup)
CREATE OR REPLACE FUNCTION sync_all_online_status()
RETURNS void AS $$
BEGIN
    -- Update users.online to match user_status.is_online
    UPDATE users 
    SET online = COALESCE(us.is_online, false)
    FROM user_status us
    WHERE users.id = us.user_id::text;
    
    -- Set users without status records to offline
    UPDATE users 
    SET online = false
    WHERE id::text NOT IN (
        SELECT user_id::text FROM user_status
    );
    
    RAISE NOTICE 'Synced online status for all users';
END;
$$ LANGUAGE plpgsql;

-- Initial sync to fix any existing inconsistencies
SELECT sync_all_online_status(); 