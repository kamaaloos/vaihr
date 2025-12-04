-- Create Login/Logout Triggers
-- This script will create proper triggers to handle online status during authentication

-- Step 1: Create a function to handle user login (set online)
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    -- Update users.online when user_status.is_online becomes true
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        UPDATE users 
        SET online = true
        WHERE id = NEW.user_id::text;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to handle user logout (set offline)
CREATE OR REPLACE FUNCTION handle_user_logout()
RETURNS TRIGGER AS $$
BEGIN
    -- Update users.online when user_status.is_online becomes false
    IF NEW.is_online = false AND OLD.is_online = true THEN
        UPDATE users 
        SET online = false
        WHERE id = NEW.user_id::text;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a comprehensive function to handle both login and logout
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

-- Step 4: Create trigger on user_status table for comprehensive sync
DROP TRIGGER IF EXISTS sync_online_status_comprehensive_trigger ON user_status;
CREATE TRIGGER sync_online_status_comprehensive_trigger
    AFTER UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status_comprehensive();

-- Step 5: Create trigger for INSERT on user_status (new user connection)
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

DROP TRIGGER IF EXISTS new_user_connection_trigger ON user_status;
CREATE TRIGGER new_user_connection_trigger
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_connection();

-- Step 6: Create a function to manually sync all users (for cleanup)
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

-- Step 7: Test the triggers by running a manual sync
SELECT sync_all_online_status();

-- Step 8: Show current trigger status
SELECT 
    'Trigger Status' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'user_status'
    AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 9: Show current online status
SELECT 
    'Current Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 10: Instructions for app integration
SELECT 
    'App Integration Instructions' as info,
    'To use these triggers in your app:' as instruction,
    '1. When user logs in: INSERT/UPDATE user_status with is_online = true' as step1,
    '2. When user logs out: UPDATE user_status with is_online = false' as step2,
    '3. The triggers will automatically sync users.online' as step3,
    '4. Call sync_all_online_status() for cleanup if needed' as step4; 