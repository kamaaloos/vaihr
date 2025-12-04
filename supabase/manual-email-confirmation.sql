-- Manual email confirmation script
-- This script can help resend confirmation emails to users who haven't received them

-- 1. Find users who need email confirmation
SELECT 
  'Users Needing Email Confirmation' as info,
  id,
  email,
  created_at,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'NEEDS CONFIRMATION'
    ELSE 'ALREADY CONFIRMED'
  END as status
FROM auth.users 
WHERE email_confirmed_at IS NULL 
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 2. Check if there are any unconfirmed users in the last 24 hours
SELECT 
  'Recent Unconfirmed Users' as info,
  COUNT(*) as count
FROM auth.users 
WHERE email_confirmed_at IS NULL 
  AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Manually confirm a user's email (use with caution)
-- Replace 'USER_ID_HERE' with the actual user ID
-- Uncomment and modify the following lines if you want to manually confirm a user:
/*
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW(),
  updated_at = NOW()
WHERE id = 'USER_ID_HERE' 
  AND email_confirmed_at IS NULL;
*/

-- 4. Check if there are any email sending issues in the logs
SELECT 
  'Recent Email Events' as info,
  id,
  event_type,
  created_at,
  user_id,
  ip_address
FROM auth.audit_log_entries 
WHERE event_type IN ('email_confirmed', 'email_confirmation_sent', 'email_change_confirmation_sent')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check all recent signup events
SELECT 
  'Recent Signup Events' as info,
  id,
  event_type,
  created_at,
  user_id,
  ip_address
FROM auth.audit_log_entries 
WHERE event_type = 'signup'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10; 