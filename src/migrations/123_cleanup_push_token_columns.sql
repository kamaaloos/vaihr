-- Cleanup Push Token Columns Migration
-- This migration removes the unused push_token column from users table
-- and fixes trigger functions that incorrectly reference push_token in notifications table

-- 1. Check if push_token column exists in users table
SELECT 
    'Users Table Columns Check' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name IN ('push_token', 'expo_push_token')
ORDER BY column_name;

-- 2. Check if push_token column exists in notifications table (it shouldn't)
SELECT 
    'Notifications Table Columns Check' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'push_token';

-- 3. Show current usage: Count users with tokens in each column
SELECT 
    'Token Usage Statistics' as check_type,
    COUNT(*) as total_users,
    COUNT(expo_push_token) as users_with_expo_push_token,
    COUNT(push_token) as users_with_push_token,
    COUNT(CASE WHEN expo_push_token IS NOT NULL AND push_token IS NOT NULL THEN 1 END) as users_with_both,
    COUNT(CASE WHEN expo_push_token IS NULL AND push_token IS NOT NULL THEN 1 END) as users_with_only_push_token,
    COUNT(CASE WHEN expo_push_token IS NOT NULL AND push_token IS NULL THEN 1 END) as users_with_only_expo_push_token
FROM users;

-- 4. If push_token has data but expo_push_token doesn't, copy it over
UPDATE users
SET expo_push_token = push_token
WHERE push_token IS NOT NULL 
    AND expo_push_token IS NULL;

-- 5. Drop push_token column from users table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'push_token'
    ) THEN
        ALTER TABLE users DROP COLUMN push_token;
        RAISE NOTICE 'Dropped push_token column from users table';
    ELSE
        RAISE NOTICE 'push_token column does not exist in users table';
    END IF;
END $$;

-- 6. Verify expo_push_token column exists and has proper index
DO $$
BEGIN
    -- Ensure expo_push_token column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'expo_push_token'
    ) THEN
        ALTER TABLE users ADD COLUMN expo_push_token TEXT;
        RAISE NOTICE 'Added expo_push_token column to users table';
    END IF;
    
    -- Ensure index exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
            AND tablename = 'users' 
            AND indexname = 'idx_users_expo_push_token'
    ) THEN
        CREATE INDEX idx_users_expo_push_token ON users(expo_push_token);
        RAISE NOTICE 'Created index on expo_push_token';
    END IF;
END $$;

-- 7. Final verification
SELECT 
    'Final Verification' as check_type,
    COUNT(*) as total_users,
    COUNT(expo_push_token) as users_with_expo_push_token,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'push_token'
        ) THEN 'push_token column still exists (ERROR)'
        ELSE 'push_token column removed (OK)'
    END as push_token_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'expo_push_token'
        ) THEN 'expo_push_token column exists (OK)'
        ELSE 'expo_push_token column missing (ERROR)'
    END as expo_push_token_status
FROM users;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

