-- Fix Deleted Messages in Chat List
-- This script will clean up the chats table to remove references to deleted messages

-- Step 1: Check current state of chats with deleted last messages
SELECT 
    'Current Chats with Deleted Messages' as info,
    c.id,
    c.admin_id,
    c.driver_id,
    c.last_message,
    c.last_message_time,
    admin.name as admin_name,
    driver.name as driver_name
FROM chats c
LEFT JOIN users admin ON c.admin_id = admin.id
LEFT JOIN users driver ON c.driver_id = driver.id
WHERE c.last_message IS NOT NULL
ORDER BY c.last_message_time DESC;

-- Step 2: Find the most recent non-deleted message for each chat
WITH latest_non_deleted_messages AS (
    SELECT 
        chat_id,
        text as last_message,
        created_at as last_message_time
    FROM (
        SELECT 
            chat_id,
            text,
            created_at,
            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
        FROM messages 
        WHERE deleted = false OR deleted IS NULL
    ) ranked
    WHERE rn = 1
)
SELECT 
    'Latest Non-Deleted Messages' as info,
    c.id as chat_id,
    c.last_message as current_last_message,
    c.last_message_time as current_last_message_time,
    m.last_message as new_last_message,
    m.last_message_time as new_last_message_time
FROM chats c
LEFT JOIN latest_non_deleted_messages m ON c.id = m.chat_id
WHERE c.last_message IS NOT NULL
ORDER BY c.last_message_time DESC;

-- Step 3: Update chats table to use the most recent non-deleted message
WITH latest_non_deleted_messages AS (
    SELECT 
        chat_id,
        text as last_message,
        created_at as last_message_time
    FROM (
        SELECT 
            chat_id,
            text,
            created_at,
            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
        FROM messages 
        WHERE deleted = false OR deleted IS NULL
    ) ranked
    WHERE rn = 1
)
UPDATE chats 
SET 
    last_message = COALESCE(m.last_message, 'No messages yet'),
    last_message_time = COALESCE(m.last_message_time, chats.created_at),
    updated_at = NOW()
FROM latest_non_deleted_messages m
WHERE chats.id = m.chat_id;

-- Step 4: For chats with no non-deleted messages, set default values
UPDATE chats 
SET 
    last_message = 'No messages yet',
    last_message_time = created_at,
    updated_at = NOW()
WHERE id NOT IN (
    SELECT DISTINCT chat_id 
    FROM messages 
    WHERE deleted = false OR deleted IS NULL
);

-- Step 5: Verify the fix
SELECT 
    'After Fix - Updated Chats' as info,
    c.id,
    c.admin_id,
    c.driver_id,
    c.last_message,
    c.last_message_time,
    admin.name as admin_name,
    driver.name as driver_name
FROM chats c
LEFT JOIN users admin ON c.admin_id = admin.id
LEFT JOIN users driver ON c.driver_id = driver.id
ORDER BY c.last_message_time DESC;

-- Step 6: Check if there are any remaining issues
SELECT 
    'Remaining Issues Check' as info,
    COUNT(*) as total_chats,
    COUNT(CASE WHEN last_message = 'No messages yet' THEN 1 END) as empty_chats,
    COUNT(CASE WHEN last_message IS NULL THEN 1 END) as null_messages
FROM chats; 