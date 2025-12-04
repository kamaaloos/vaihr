-- Fix missing user_status table issue
-- This script will either create the missing table or remove the problematic trigger

-- Option 1: Create the missing user_status table
CREATE TABLE IF NOT EXISTS user_status (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    platform VARCHAR(50) DEFAULT 'web',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_is_online ON user_status(is_online);

-- Option 2: Remove the problematic trigger (uncomment if you don't need user_status)
-- DROP TRIGGER IF EXISTS ensure_driver_status_trigger ON auth.users;
-- DROP FUNCTION IF EXISTS ensure_driver_status();

-- Check if the trigger exists and what it's doing
SELECT 
  'Trigger Info' as info,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'ensure_driver_status_trigger';

-- Check if user_status table exists
SELECT 
  'Table Check' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'user_status'; 