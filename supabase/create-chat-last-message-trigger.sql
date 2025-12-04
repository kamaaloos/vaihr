-- Create Trigger to Update Chat Last Message
-- This trigger will automatically update the chat's last_message when messages are modified

-- Step 1: Create function to update chat's last message
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
    -- If a message is deleted, update the chat's last_message
    IF TG_OP = 'UPDATE' AND NEW.deleted = true AND (OLD.deleted = false OR OLD.deleted IS NULL) THEN
        -- Find the most recent non-deleted message for this chat
        UPDATE chats 
        SET 
            last_message = COALESCE(
                (SELECT text FROM messages 
                 WHERE chat_id = NEW.chat_id 
                   AND (deleted = false OR deleted IS NULL)
                 ORDER BY created_at DESC 
                 LIMIT 1),
                'No messages yet'
            ),
            last_message_time = COALESCE(
                (SELECT created_at FROM messages 
                 WHERE chat_id = NEW.chat_id 
                   AND (deleted = false OR deleted IS NULL)
                 ORDER BY created_at DESC 
                 LIMIT 1),
                chats.created_at
            ),
            updated_at = NOW()
        WHERE id = NEW.chat_id;
        
        RETURN NEW;
    END IF;
    
    -- If a message is inserted, update the chat's last_message
    IF TG_OP = 'INSERT' AND (NEW.deleted = false OR NEW.deleted IS NULL) THEN
        UPDATE chats 
        SET 
            last_message = NEW.text,
            last_message_time = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.chat_id;
        
        RETURN NEW;
    END IF;
    
    -- If a message is updated (but not deleted), update the chat's last_message if it's the most recent
    IF TG_OP = 'UPDATE' AND (NEW.deleted = false OR NEW.deleted IS NULL) THEN
        -- Only update if this is the most recent message
        IF NEW.created_at = (
            SELECT MAX(created_at) 
            FROM messages 
            WHERE chat_id = NEW.chat_id 
              AND (deleted = false OR deleted IS NULL)
        ) THEN
            UPDATE chats 
            SET 
                last_message = NEW.text,
                last_message_time = NEW.created_at,
                updated_at = NOW()
            WHERE id = NEW.chat_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on messages table
DROP TRIGGER IF EXISTS update_chat_last_message_trigger ON messages;
CREATE TRIGGER update_chat_last_message_trigger
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_last_message();

-- Step 3: Test the trigger by checking current state
SELECT 
    'Trigger Test - Current State' as info,
    c.id as chat_id,
    c.last_message,
    c.last_message_time,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.deleted = true THEN 1 END) as deleted_messages,
    COUNT(CASE WHEN m.deleted = false OR m.deleted IS NULL THEN 1 END) as active_messages
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
GROUP BY c.id, c.last_message, c.last_message_time
ORDER BY c.last_message_time DESC;

-- Step 4: Show the most recent non-deleted message for each chat
SELECT 
    'Most Recent Non-Deleted Messages' as info,
    c.id as chat_id,
    c.last_message as chat_last_message,
    m.text as actual_last_message,
    m.created_at as actual_last_message_time,
    m.deleted
FROM chats c
LEFT JOIN (
    SELECT 
        chat_id,
        text,
        created_at,
        deleted,
        ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
    FROM messages 
    WHERE deleted = false OR deleted IS NULL
) m ON c.id = m.chat_id AND m.rn = 1
ORDER BY c.last_message_time DESC; 