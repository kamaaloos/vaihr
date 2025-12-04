-- Enable real-time for the messages table
-- This is required for real-time subscriptions to work

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify real-time is enabled
SELECT 
  'Real-time Status' as info,
  schemaname,
  relname as table_name
FROM pg_stat_user_tables 
WHERE relname = 'messages';

-- Check publication status
SELECT 
  'Publication Status' as info,
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- List all tables in the real-time publication
SELECT 
  'Tables in Real-time Publication' as info,
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename; 