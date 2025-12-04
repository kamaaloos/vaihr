-- Disable email confirmation requirement
-- This will allow users to sign up without email verification
-- WARNING: Only use this for testing, not for production!

-- Check current email confirmation settings
SELECT 
  'Current Settings' as info,
  'Email confirmation may be enabled by default' as status;

-- Note: In newer Supabase versions, email confirmation settings are managed
-- through the Supabase Dashboard, not through SQL commands.

-- To disable email confirmation:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Authentication → Settings
-- 3. Find "Enable email confirmations" and turn it OFF
-- 4. Save the settings

-- Alternative: You can also modify the signup process to auto-confirm users
-- by setting email_confirmed_at in the database after user creation

-- Check recent unconfirmed users
SELECT 
  'Unconfirmed Users' as info,
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email_confirmed_at IS NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC; 