-- Test real-time subscription and database permissions
-- This script will help diagnose why real-time messages are not being received

-- 1. Check if the chat exists and has the correct participants
SELECT 
  'Chat Info' as info,
  id as chat_id,
  driver_id,
  admin_id,
  created_at,
  updated_at
FROM chats 
WHERE id = '1f6bedf2-123e-43d6-aa80-9032d6b1b074';

-- 2. Check if messages exist in this chat
SELECT 
  'Messages in Chat' as info,
  id as message_id,
  text,
  sender_id,
  chat_id,
  created_at,
  read,
  delivered
FROM messages 
WHERE chat_id = '1f6bedf2-123e-43d6-aa80-9032d6b1b074'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check RLS policies on messages table
SELECT 
  'RLS Policies' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- 4. Check if the current user has access to the messages
-- (This will be run as the authenticated user)
SELECT 
  'Current User Access Test' as info,
  COUNT(*) as message_count
FROM messages 
WHERE chat_id = '1f6bedf2-123e-43d6-aa80-9032d6b1b074';

-- 5. Check if real-time is enabled for the messages table
SELECT 
  'Real-time Status' as info,
  schemaname,
  relname as table_name
FROM pg_stat_user_tables 
WHERE relname = 'messages';

-- 6. Test inserting a message to see if it triggers real-time
-- (This will help verify if the issue is with sending or receiving)
INSERT INTO messages (
  chat_id,
  text,
  sender_id,
  created_at,
  updated_at,
  read,
  delivered
) VALUES (
  '1f6bedf2-123e-43d6-aa80-9032d6b1b074',
  'Test message from SQL script',
  'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
  NOW(),
  NOW(),
  false,
  false
) RETURNING id, text, created_at; 