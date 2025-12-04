-- Fix User Status Table Constraints and Data Issues
-- This script helps resolve the unique constraint violation error

-- Step 1: Check current user_status table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_status' 
ORDER BY ordinal_position;

-- Step 2: Check for duplicate user_id entries
SELECT 
    user_id,
    COUNT(*) as count
FROM user_status 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Step 3: Check for any orphaned user_status records (users that don't exist)
SELECT 
    us.user_id,
    us.is_online,
    us.last_seen
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
WHERE u.id IS NULL;

-- Step 4: Clean up duplicate entries (keep the most recent one)
WITH duplicates AS (
    SELECT 
        user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) as rn
    FROM user_status
)
DELETE FROM user_status 
WHERE (user_id, updated_at) IN (
    SELECT us.user_id, us.updated_at
    FROM user_status us
    JOIN duplicates d ON us.user_id = d.user_id
    WHERE d.rn > 1
);

-- Step 5: Clean up orphaned records
DELETE FROM user_status 
WHERE user_id::text NOT IN (SELECT id FROM users);

-- Step 6: Ensure unique constraint exists
-- Drop existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_status_user_id_key' 
        AND table_name = 'user_status'
    ) THEN
        ALTER TABLE user_status DROP CONSTRAINT user_status_user_id_key;
    END IF;
END $$;

-- Add unique constraint
ALTER TABLE user_status ADD CONSTRAINT user_status_user_id_key UNIQUE (user_id);

-- Step 7: Verify the fix
SELECT 
    'user_status table structure:' as info,
    COUNT(*) as total_records
FROM user_status;

-- Step 8: Check for any remaining issues
SELECT 
    'Checking for remaining duplicates:' as info,
    COUNT(*) as duplicate_count
FROM (
    SELECT user_id, COUNT(*) as count
    FROM user_status 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
) duplicates;

-- Step 9: Show current user_status records
SELECT 
    'Current user_status records:' as info,
    us.user_id,
    u.name,
    us.is_online,
    us.platform,
    us.last_seen,
    us.created_at,
    us.updated_at
FROM user_status us
LEFT JOIN users u ON us.user_id::text = u.id
ORDER BY us.updated_at DESC;

-- Step 10: Instructions for testing
SELECT 
    'Testing Instructions:' as info,
    '1. Try logging in again' as step1,
    '2. Check console logs for OnlineStatusManager messages' as step2,
    '3. Verify user_status table has correct records' as step3,
    '4. Test app background/foreground functionality' as step4; 