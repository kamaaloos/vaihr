-- Fix Online Status Trigger
-- Replace the complex conditional trigger with a simple, reliable one

-- Step 1: Drop existing triggers and functions
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_update ON user_status;
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_insert ON user_status;
DROP TRIGGER IF EXISTS sync_online_status_comprehensive_trigger ON user_status;
DROP FUNCTION IF EXISTS sync_online_status();
DROP FUNCTION IF EXISTS sync_online_status_comprehensive();

-- Step 2: Create a simple, reliable trigger function
CREATE OR REPLACE FUNCTION sync_online_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Always sync user_status.is_online to users.online
    UPDATE users 
    SET 
        online = NEW.is_online,
        updated_at = NOW()
    WHERE id = NEW.user_id::text;
    
    -- Log the sync operation
    RAISE NOTICE 'Synced online status: user_id=%, is_online=%, users.online updated to %', 
        NEW.user_id, NEW.is_online, NEW.is_online;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create triggers for both INSERT and UPDATE
CREATE TRIGGER sync_online_status_on_user_status_insert
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

CREATE TRIGGER sync_online_status_on_user_status_update
    AFTER UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

-- Step 4: Verify triggers were created
SELECT 
    'Created Triggers' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%sync_online_status%'
ORDER BY trigger_name;

-- Step 5: Test the trigger with the specific user
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 6: Check if the trigger worked
SELECT 
    'Trigger Test Result' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 7: Test with a different user (if available)
-- Uncomment and replace with another user ID to test
/*
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

SELECT 
    'Offline Test Result' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';
*/

-- Step 8: Show final status for all users
SELECT 
    'Final Status for All Users' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 9: Instructions for app testing
SELECT 
    'App Testing Instructions' as info,
    '1. Try logging in with the app again' as step1,
    '2. Check console logs for OnlineStatusManager messages' as step2,
    '3. Verify both user_status.is_online and users.online are true' as step3,
    '4. Test app background/foreground functionality' as step4; 