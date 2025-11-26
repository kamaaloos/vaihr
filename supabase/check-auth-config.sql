-- Check Supabase Auth Configuration
-- This will help identify why auth.signUp() is failing

-- 1. Check if auth.users table exists and is accessible
SELECT 
    'Auth Users Table Check' as info,
    COUNT(*) as total_auth_users
FROM auth.users;

-- 2. Check auth configuration
SELECT 
    'Auth Config Check' as info,
    key,
    value
FROM auth.config
WHERE key IN ('SITE_URL', 'DISABLE_SIGNUP', 'ENABLE_EMAIL_CONFIRMATIONS', 'ENABLE_PHONE_CONFIRMATIONS');

-- 3. Check if there are any auth policies blocking signup
SELECT 
    'Auth Policies Check' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users' 
    AND schemaname = 'auth';

-- 4. Check auth.users table permissions
SELECT 
    'Auth Users Permissions' as info,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'users' 
    AND table_schema = 'auth';

-- 5. Check if email confirmations are enabled
SELECT 
    'Email Confirmation Status' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM auth.config 
            WHERE key = 'ENABLE_EMAIL_CONFIRMATIONS' 
            AND value = 'true'
        ) THEN 'ENABLED - Users must verify email'
        ELSE 'DISABLED - Users can sign up without email verification'
    END as email_confirmation_status;















