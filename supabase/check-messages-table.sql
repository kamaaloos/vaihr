-- Check messages table structure and fix column issues
-- Run this in the Supabase SQL Editor

-- Check if messages table exists
SELECT 
    'Table Check' as info,
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename = 'messages';

-- Check messages table structure
SELECT 
    'Column Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Check if recipient_id column exists
SELECT 
    'Recipient ID Check' as info,
    COUNT(*) as column_exists
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'recipient_id';

-- Show all columns in messages table
SELECT 
    'All Columns' as info,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'messages';

-- Check RLS policies on messages table
SELECT 
    'RLS Policies' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'messages'
ORDER BY policyname; 