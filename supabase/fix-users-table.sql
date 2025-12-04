-- Fix users table for notification system
-- Run this in the Supabase SQL Editor

-- Step 1: Add missing columns to users table
DO $$
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE '✅ Added role column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ role column already exists';
    END IF;
    
    -- Add online_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'online_status'
    ) THEN
        ALTER TABLE users ADD COLUMN online_status TEXT DEFAULT 'offline';
        RAISE NOTICE '✅ Added online_status column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ online_status column already exists';
    END IF;
END $$;

-- Step 2: Show updated table structure
SELECT 
    'Updated Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Step 3: Create some test users with driver roles (including required name field)
INSERT INTO users (id, email, name, role, online_status, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'driver1@test.com', 'Test Driver 1', 'driver', 'online', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'driver2@test.com', 'Test Driver 2', 'driver', 'online', NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'driver3@test.com', 'Test Driver 3', 'driver', 'offline', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    online_status = EXCLUDED.online_status,
    updated_at = NOW();

-- Step 4: Show current users
SELECT 
    'Current Users' as info,
    id,
    email,
    name,
    role,
    online_status,
    created_at
FROM users
ORDER BY created_at DESC;

-- Step 5: Count users by role
SELECT 
    'Users by Role' as info,
    role,
    COUNT(*) as count
FROM users
GROUP BY role;

-- Step 6: Count online drivers
SELECT 
    'Online Drivers' as info,
    COUNT(*) as count
FROM users
WHERE role = 'driver' AND online_status = 'online'; 