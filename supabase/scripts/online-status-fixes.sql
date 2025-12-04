-- Online Status Fixes - Utility Script
-- This script contains all the fixes for online status issues

-- ===========================================
-- 1. CHECK CURRENT STATUS
-- ===========================================

-- Check current online status
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

-- ===========================================
-- 2. CREATE TRIGGERS (if not already created)
-- ===========================================

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

-- ===========================================
-- 3. FIX STALE ADMIN STATUS
-- ===========================================

-- Set admin users to offline (they're not connected)
UPDATE users 
SET online = false
WHERE role = 'admin' OR email LIKE '%admin%';

UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW() - INTERVAL '1 hour',
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND (u.role = 'admin' OR u.email LIKE '%admin%');

-- ===========================================
-- 4. SYNC ALL USERS
-- ===========================================

-- Run the sync function
SELECT sync_all_online_status();

-- ===========================================
-- 5. VERIFY RESULTS
-- ===========================================

-- Show final status
SELECT 
    'Final Online Status' as info,
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

-- Show only connected users
SELECT 
    'Connected Users Only' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true 
    AND us.is_online = true
    AND u.role != 'admin'
    AND u.email NOT LIKE '%admin%'
ORDER BY us.last_seen DESC;

-- Final summary
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM users WHERE online = true) as users_online,
    (SELECT COUNT(*) FROM users WHERE online = false) as users_offline,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as status_online,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as status_offline; 