-- Recreate Online Status Triggers
-- This script drops and recreates the triggers to fix any issues

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_update ON user_status;
DROP TRIGGER IF EXISTS sync_online_status_on_user_status_insert ON user_status;
DROP FUNCTION IF EXISTS sync_online_status();

-- Step 2: Create the trigger function
CREATE OR REPLACE FUNCTION sync_online_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the trigger execution
    RAISE NOTICE 'sync_online_status triggered: user_id=%, is_online=%, operation=%', 
        NEW.user_id, NEW.is_online, TG_OP;
    
    -- Update the users table based on user_status.is_online
    UPDATE users 
    SET 
        online = NEW.is_online,
        updated_at = NOW()
    WHERE id = NEW.user_id::text;
    
    -- Log the result
    RAISE NOTICE 'Updated users.online to % for user %', NEW.is_online, NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create triggers for UPDATE and INSERT
CREATE TRIGGER sync_online_status_on_user_status_update
    AFTER UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

CREATE TRIGGER sync_online_status_on_user_status_insert
    AFTER INSERT ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

-- Step 4: Verify triggers were created
SELECT 
    'Created Triggers' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%sync_online_status%'
ORDER BY trigger_name;

-- Step 5: Test the trigger with a manual update
-- Replace '36a28a98-995f-4452-86fa-7d8bcc9ed0f1' with your actual user ID
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

-- Step 7: Test with a new user (if needed)
-- Uncomment and replace with a different user ID to test
/*
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid,
    true,
    'mobile',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW();
*/

-- Step 8: Show final status
SELECT 
    'Final Status Check' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC; 