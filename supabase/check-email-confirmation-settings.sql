-- Check email confirmation settings for Supabase Auth
-- This script will help diagnose why email verification emails are not being sent

-- 1. Check recent auth events to see if signup attempts are being recorded
SELECT 
  'Recent Auth Events' as info,
  id,
  event_type,
  created_at,
  user_id,
  ip_address
FROM auth.audit_log_entries 
WHERE event_type = 'signup'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if there are any pending email confirmations
SELECT 
  'Pending Email Confirmations' as info,
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at
FROM auth.users 
WHERE email_confirmed_at IS NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 3. Check auth schema version and settings
SELECT 
  'Schema Info' as info,
  version,
  statements
FROM auth.schema_migrations 
ORDER BY version DESC 
LIMIT 5;

-- 4. Check if there are any email templates configured
SELECT 
  'Email Templates' as info,
  template_type,
  subject,
  content_html IS NOT NULL as has_html_content,
  content_text IS NOT NULL as has_text_content
FROM auth.email_templates;

-- 5. Check recent email-related events
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

-- 6. Check all users created in the last 24 hours
SELECT 
  'Recent Users' as info,
  id,
  email,
  created_at,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'NEEDS CONFIRMATION'
    ELSE 'CONFIRMED'
  END as status
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC; 