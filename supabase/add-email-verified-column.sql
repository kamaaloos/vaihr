-- Add email_verified column to users table for OTP signup flow
-- Run this in your Supabase SQL Editor

-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Update existing users to have email_verified = true (assuming they were verified through Supabase auth)
UPDATE users SET email_verified = true WHERE email_verified IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address via OTP or email link';

-- Test the column addition
SELECT 'email_verified column added successfully' as status;

-- Show sample data
SELECT id, email, name, role, email_verified, created_at 
FROM users 
LIMIT 5;
