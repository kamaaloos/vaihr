-- Fix Online Status Triggers
-- This script will check and fix the online status triggers

-- Step 1: Check if triggers exist
SELECT 
    'Existing Triggers' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
    AND event_object_table IN ('user_status', 'users')
ORDER BY trigger_name;

-- Step 2: Check if trigger functions exist
SELECT 
    'Existing Functions' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%online%'
ORDER BY routine_name;

-- Step 3: Drop existing triggers and functions to recreate them cleanly
DROP TRIGGER IF EXISTS sync_user_status_to_users ON user_status;
DROP TRIGGER IF EXISTS sync_users_to_user_status ON users;
DROP FUNCTION IF EXISTS sync_user_status_to_users();
DROP FUNCTION IF EXISTS sync_users_to_user_status();

-- Step 4: Create the trigger function for user_status -> users sync
CREATE OR REPLACE FUNCTION sync_user_status_to_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Update users.online based on user_status.is_online
    UPDATE users 
    SET 
        online = NEW.is_online,
        updated_at = NOW()
    WHERE id = NEW.user_id::text;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the trigger function for users -> user_status sync
CREATE OR REPLACE FUNCTION sync_users_to_user_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user_status.is_online based on users.online
    UPDATE user_status 
    SET 
        is_online = NEW.online,
        last_seen = CASE 
            WHEN NEW.online = true THEN NOW()
            ELSE last_seen
        END,
        updated_at = NOW()
    WHERE user_id = NEW.id::uuid;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create triggers
CREATE TRIGGER sync_user_status_to_users
    AFTER INSERT OR UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_status_to_users();

CREATE TRIGGER sync_users_to_user_status
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.online IS DISTINCT FROM NEW.online)
    EXECUTE FUNCTION sync_users_to_user_status();

-- Step 7: Test the triggers
-- First, let's see current state
SELECT 
    'Current State Before Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC;

-- Step 8: Test user_status -> users sync
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users LIMIT 1)::uuid;

-- Step 9: Check if trigger worked
SELECT 
    'After user_status Update Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = (SELECT id FROM users LIMIT 1)
ORDER BY u.online DESC;

-- Step 10: Test users -> user_status sync
UPDATE users 
SET 
    online = false,
    updated_at = NOW()
WHERE id = (SELECT id FROM users LIMIT 1);

-- Step 11: Check if trigger worked
SELECT 
    'After users Update Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = (SELECT id FROM users LIMIT 1)
ORDER BY u.online DESC;

-- Step 12: Show final trigger status
SELECT 
    'Final Trigger Status' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
    AND event_object_table IN ('user_status', 'users')
ORDER BY trigger_name;

-- Step 13: Instructions for testing
SELECT 
    'Testing Instructions' as info,
    '1. Try logging in with any account' as step1,
    '2. Check that user goes online in both tables' as step2,
    '3. Try logging out' as step3,
    '4. Check that user goes offline in both tables' as step4,
    '5. Monitor console logs for verification attempts' as step5; 