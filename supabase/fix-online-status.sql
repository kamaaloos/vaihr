-- Fix Online Status System
-- Run this in the Supabase SQL Editor to fix online status issues

-- Step 1: Check current online status state
SELECT 
    'Current Online Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 2: Check if user_status table exists and has proper structure
SELECT 
    'User Status Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Step 3: Check if users table has online status columns
SELECT 
    'Users Table Online Columns' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('is_online', 'online_status', 'last_seen')
ORDER BY column_name;

-- Step 4: Check full users table structure
SELECT 
    'Users Table Full Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Step 5: Create a simple function to set all current users as online
CREATE OR REPLACE FUNCTION set_all_users_online()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    affected_rows INTEGER;
BEGIN
    RAISE NOTICE 'Setting all users as online...';
    
    -- Update users table (only is_online and updated_at)
    UPDATE users 
    SET 
        is_online = true,
        updated_at = NOW()
    WHERE is_online = false OR is_online IS NULL;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Updated % users in users table', affected_rows;
    
    -- Update user_status table
    FOR user_record IN 
        SELECT id FROM users 
        WHERE is_online = true
    LOOP
        INSERT INTO user_status (
            user_id,
            is_online,
            platform,
            last_seen,
            created_at,
            updated_at
        ) VALUES (
            user_record.id,
            true,
            'mobile',
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            is_online = true,
            last_seen = NOW(),
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE '✅ All users set as online';
END;
$$;

-- Step 6: Create a simple online status update function
CREATE OR REPLACE FUNCTION update_user_online_status(
    p_user_id TEXT,
    p_is_online BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update users table (only is_online and updated_at)
    UPDATE users 
    SET 
        is_online = p_is_online,
        updated_at = NOW()
    WHERE id::text = p_user_id;
    
    -- Update user_status table
    INSERT INTO user_status (
        user_id,
        is_online,
        platform,
        last_seen,
        created_at,
        updated_at
    ) VALUES (
        p_user_id::uuid,
        p_is_online,
        'mobile',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        is_online = p_is_online,
        last_seen = NOW(),
        updated_at = NOW();
        
    RAISE NOTICE 'Updated online status for user %: %', p_user_id, p_is_online;
END;
$$;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION set_all_users_online() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_online_status(TEXT, BOOLEAN) TO authenticated;

-- Step 8: Set all current users as online
SELECT set_all_users_online();

-- Step 9: Show updated status
SELECT 
    'Updated Online Status' as info,
    (SELECT COUNT(*) FROM users WHERE is_online = true) as online_users,
    (SELECT COUNT(*) FROM users WHERE is_online = false) as offline_users,
    (SELECT COUNT(*) FROM user_status WHERE is_online = true) as online_status_records,
    (SELECT COUNT(*) FROM user_status WHERE is_online = false) as offline_status_records;

-- Step 10: Show current online users
SELECT 
    'Online Users' as info,
    id,
    name,
    email,
    role,
    is_online,
    created_at
FROM users 
WHERE is_online = true
ORDER BY created_at DESC;

-- Step 11: Create a simple trigger to keep online status in sync
DROP TRIGGER IF EXISTS sync_online_status_trigger ON users;
DROP FUNCTION IF EXISTS sync_online_status();

CREATE OR REPLACE FUNCTION sync_online_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Sync with user_status table
    INSERT INTO user_status (
        user_id,
        is_online,
        platform,
        last_seen,
        created_at,
        updated_at
    ) VALUES (
        NEW.id::uuid,
        NEW.is_online,
        'mobile',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        is_online = NEW.is_online,
        last_seen = NOW(),
        updated_at = NOW();
        
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_online_status_trigger
    AFTER UPDATE OF is_online ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

-- Step 12: Grant permissions for the trigger function
GRANT EXECUTE ON FUNCTION sync_online_status() TO authenticated;

-- Step 13: Test the system by updating a specific user
DO $$
DECLARE
    test_user_id TEXT;
BEGIN
    -- Get the first user to test with
    SELECT id::text INTO test_user_id FROM users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing online status update for user: %', test_user_id;
        
        -- Update the user's online status
        PERFORM update_user_online_status(test_user_id, true);
        
        RAISE NOTICE '✅ Test completed successfully';
    ELSE
        RAISE NOTICE '❌ No users found to test with';
    END IF;
END $$; 