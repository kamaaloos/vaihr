-- Simple Auth Configuration Check
-- This works with all Supabase versions

-- 1. Check if auth.users table is accessible
SELECT 
    'Auth Users Access' as info,
    COUNT(*) as total_auth_users
FROM auth.users;

-- 2. Check auth.users table structure
SELECT 
    'Auth Users Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'auth'
ORDER BY ordinal_position;

-- 3. Check if we can insert into auth.users (this will be rolled back)
BEGIN;
    -- Try to insert a test user (this will fail but show us the error)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'test@example.com',
        crypt('testpassword', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    );
ROLLBACK;

-- 4. Check auth schema permissions
SELECT 
    'Auth Schema Permissions' as info,
    grantee,
    privilege_type
FROM information_schema.usage_privileges 
WHERE object_name = 'auth' 
    AND object_type = 'SCHEMA';















