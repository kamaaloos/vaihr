-- Fix Online Status Trigger (with CASCADE)
-- Drop all dependent objects and recreate the triggers properly

-- Step 1: Drop all triggers and functions with CASCADE
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_update ON user_status CASCADE;
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_insert ON user_status CASCADE;
DROP TRIGGER IF EXISTS sync_online_status_comprehensive_trigger ON user_status CASCADE;
DROP TRIGGER IF EXISTS sync_online_status_new_trigger ON users CASCADE;
DROP FUNCTION IF EXISTS sync_online_status() CASCADE;
DROP FUNCTION IF EXISTS sync_online_status_comprehensive() CASCADE;

-- Step 2: Create a simple, reliable trigger function for user_status -> users sync
CREATE OR REPLACE FUNCTION sync_user_status_to_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Always sync user_status.is_online to users.online
    UPDATE users 
    SET 
        online = NEW.is_online,
        updated_at = NOW()
    WHERE id = NEW.user_id::text;
    
    -- Log the sync operation
    RAISE NOTICE 'Synced user_status to users: user_id=%, is_online=%, users.online updated to %', 
        NEW.user_id, NEW.is_online, NEW.is_online;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a trigger function for users -> user_status sync (if needed)
CREATE OR REPLACE FUNCTION sync_users_to_user_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user_status when users.online changes
    UPDATE user_status 
    SET 
        is_online = NEW.online,
        last_seen = CASE 
            WHEN NEW.online = true THEN NOW()
            ELSE last_seen
        END,
        updated_at = NOW()
    WHERE user_id::text = NEW.id;
    
    -- Log the sync operation
    RAISE NOTICE 'Synced users to user_status: user_id=%, online=%, user_status.is_online updated to %', 
        NEW.id, NEW.online, NEW.online;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create triggers for user_status table (user_status -> users sync)
CREATE TRIGGER sync_user_status_to_users_insert
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_status_to_users();

CREATE TRIGGER sync_user_status_to_users_update
    AFTER UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_status_to_users();

-- Step 5: Create trigger for users table (users -> user_status sync)
CREATE TRIGGER sync_users_to_user_status_update
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.online IS DISTINCT FROM NEW.online)
    EXECUTE FUNCTION sync_users_to_user_status();

-- Step 6: Verify triggers were created
SELECT 
    'Created Triggers' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table as table_name
FROM information_schema.triggers 
WHERE trigger_name LIKE '%sync%'
ORDER BY event_object_table, trigger_name;

-- Step 7: Test the trigger with the specific user
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 8: Check if the trigger worked
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

-- Step 9: Test the reverse sync (users -> user_status)
UPDATE users 
SET 
    online = false,
    updated_at = NOW()
WHERE id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

SELECT 
    'Reverse Sync Test Result' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 10: Set user back to online for app testing
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 11: Show final status for all users
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

-- Step 12: Instructions for app testing
SELECT 
    'App Testing Instructions' as info,
    '1. Try logging in with the app again' as step1,
    '2. Check console logs for OnlineStatusManager messages' as step2,
    '3. Verify both user_status.is_online and users.online are true' as step3,
    '4. Test app background/foreground functionality' as step4,
    '5. Test logout functionality' as step5; 