-- Remove Redundant Online Status Columns (with trigger handling)
-- This script will safely remove is_online and online_status columns

-- Step 1: Check current state before removal
SELECT 
    'Before Removal' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false
FROM users;

-- Step 2: Show the trigger that's causing the issue
SELECT 
    'Dependent Trigger' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
    AND trigger_name = 'sync_online_status_trigger';

-- Step 3: Drop the dependent trigger first
DROP TRIGGER IF EXISTS sync_online_status_trigger ON users;

-- Step 4: Show current values for all users
SELECT 
    'Current Values Before Removal' as info,
    id,
    name,
    email,
    role,
    online as main_online_column,
    is_online as redundant_column1,
    online_status as redundant_column2
FROM users 
ORDER BY name;

-- Step 5: Remove the redundant is_online column
ALTER TABLE users DROP COLUMN IF EXISTS is_online;

-- Step 6: Remove the redundant online_status column
ALTER TABLE users DROP COLUMN IF EXISTS online_status;

-- Step 7: Verify the columns were removed
SELECT 
    'After Removal - Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
    AND (column_name LIKE '%online%' OR column_name = 'online')
ORDER BY ordinal_position;

-- Step 8: Verify data integrity after removal
SELECT 
    'After Removal - Data Verification' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN online = true THEN 1 END) as online_true,
    COUNT(CASE WHEN online = false THEN 1 END) as online_false
FROM users;

-- Step 9: Show final clean status
SELECT 
    'Final Clean Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as online_status,
    us.is_online as user_status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 10: Show only connected users
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
ORDER BY us.last_seen DESC;

-- Step 11: Create a new, simplified trigger if needed
-- This trigger will sync users.online with user_status.is_online
CREATE OR REPLACE FUNCTION sync_online_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user_status when users.online changes
    IF TG_OP = 'UPDATE' THEN
        UPDATE user_status 
        SET 
            is_online = NEW.online,
            last_seen = CASE 
                WHEN NEW.online = true THEN NOW()
                ELSE last_seen
            END,
            updated_at = NOW()
        WHERE user_id::text = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
DROP TRIGGER IF EXISTS sync_online_status_new_trigger ON users;
CREATE TRIGGER sync_online_status_new_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_online_status();

-- Step 12: Final summary
SELECT 
    'Cleanup Complete' as info,
    'Successfully removed redundant columns:' as action,
    '1. is_online (redundant boolean column)' as removed1,
    '2. online_status (redundant text column)' as removed2,
    '3. sync_online_status_trigger (old trigger)' as removed3,
    'Kept: online (main boolean column)' as kept,
    'Created: sync_online_status_new_trigger (simplified)' as created,
    'Total users: ' || (SELECT COUNT(*) FROM users) as total_users,
    'Online users: ' || (SELECT COUNT(*) FROM users WHERE online = true) as online_users,
    'Offline users: ' || (SELECT COUNT(*) FROM users WHERE online = false) as offline_users; 