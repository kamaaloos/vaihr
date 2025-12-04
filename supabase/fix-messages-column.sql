-- Fix messages table column issue
-- Run this in the Supabase SQL Editor

-- First, let's see the actual table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Check if we need to add recipient_id column
DO $$
BEGIN
    -- Check if recipient_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'recipient_id'
    ) THEN
        -- Add recipient_id column if it doesn't exist
        ALTER TABLE messages ADD COLUMN recipient_id UUID REFERENCES auth.users(id);
        RAISE NOTICE '✅ Added recipient_id column to messages table';
    ELSE
        RAISE NOTICE 'ℹ️ recipient_id column already exists';
    END IF;
END $$;

-- Show the updated table structure
SELECT 
    'Updated Structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Check if there are any existing messages that need recipient_id populated
SELECT 
    'Existing Messages' as info,
    COUNT(*) as total_messages,
    COUNT(recipient_id) as messages_with_recipient,
    COUNT(*) - COUNT(recipient_id) as messages_without_recipient
FROM messages; 