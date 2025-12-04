-- Test Chat Creation and Message Functionality
-- This script will help verify that chat creation and message sending work correctly

-- Step 1: Check if chats table exists and has correct structure
SELECT 
    'Chats Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'chats' 
ORDER BY ordinal_position;

-- Step 2: Check if messages table exists and has correct structure
SELECT 
    'Messages Table Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
ORDER BY ordinal_position;

-- Step 3: Check existing chats
SELECT 
    'Existing Chats' as info,
    id,
    driver_id,
    admin_id,
    last_message,
    last_message_time,
    created_at
FROM chats
ORDER BY created_at DESC;

-- Step 4: Check existing messages
SELECT 
    'Existing Messages' as info,
    id,
    chat_id,
    sender_id,
    text,
    created_at,
    read,
    deleted
FROM messages
ORDER BY created_at DESC;

-- Step 5: Check RLS policies for chats table
SELECT 
    'Chats RLS Policies' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'chats';

-- Step 6: Check RLS policies for messages table
SELECT 
    'Messages RLS Policies' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- Step 7: Check if unique constraint exists on chats table
SELECT 
    'Unique Constraints on Chats' as info,
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'chats' 
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 8: Test if we can insert a test chat (simple insert without ON CONFLICT)
-- Note: This is just for testing, the actual chat creation should be done by the app
INSERT INTO chats (
    driver_id,
    admin_id,
    created_at,
    updated_at
) VALUES (
    '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid, -- Test Driver
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid, -- Test Admin
    NOW(),
    NOW()
)
RETURNING id, driver_id, admin_id, created_at;

-- Step 9: Check if the test chat was created
SELECT 
    'Test Chat Creation' as info,
    id,
    driver_id,
    admin_id,
    created_at
FROM chats
WHERE driver_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid
AND admin_id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid; 