-- This migration replaces 018_sync_user_online_status.sql
-- It ensures that user online status is properly synced between tables

-- Create a trigger function to sync online status with auth.users metadata
CREATE OR REPLACE FUNCTION sync_user_online_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Update the auth.users metadata with online status
    UPDATE auth.users
    SET raw_app_meta_data = 
        CASE 
            WHEN raw_app_meta_data IS NULL THEN 
                jsonb_build_object('is_online', NEW.is_online, 'last_seen', NEW.last_seen)
            ELSE
                raw_app_meta_data || 
                jsonb_build_object('is_online', NEW.is_online, 'last_seen', NEW.last_seen)
        END
    WHERE id = NEW.user_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in sync_user_online_status: %', SQLERRM;
        RETURN NEW; -- Continue with the update even if sync fails
END;
$$;

-- Create trigger to sync status on update
DROP TRIGGER IF EXISTS sync_user_online_status_trigger ON user_status;
CREATE TRIGGER sync_user_online_status_trigger
    AFTER UPDATE OF is_online, last_seen ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_online_status();

-- Create trigger to sync status on insert
DROP TRIGGER IF EXISTS sync_user_online_status_insert_trigger ON user_status;
CREATE TRIGGER sync_user_online_status_insert_trigger
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_online_status();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_user_online_status() TO authenticated;
ALTER FUNCTION sync_user_online_status() OWNER TO postgres; 