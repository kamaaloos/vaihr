-- Fix Chats Table Constraints
-- This script will check and fix the unique constraint issue

-- Step 1: Check current table structure
SELECT 
    'Current Chats Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chats' 
ORDER BY ordinal_position;

-- Step 2: Check existing constraints
SELECT 
    'Existing Constraints' as info,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'chats'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Step 3: Check if unique constraint exists
SELECT 
    'Unique Constraints Check' as info,
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'chats' 
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 4: Add unique constraint if it doesn't exist
-- First, let's check if there are any duplicate combinations
SELECT 
    'Duplicate Check' as info,
    driver_id,
    admin_id,
    COUNT(*) as count
FROM chats
GROUP BY driver_id, admin_id
HAVING COUNT(*) > 1;

-- Step 5: Remove duplicates if they exist (keep the most recent one)
DELETE FROM chats 
WHERE id NOT IN (
    SELECT DISTINCT ON (driver_id, admin_id) id
    FROM chats
    ORDER BY driver_id, admin_id, created_at DESC
);

-- Step 6: Add unique constraint
ALTER TABLE chats 
ADD CONSTRAINT chats_driver_admin_unique 
UNIQUE (driver_id, admin_id);

-- Step 7: Verify the constraint was added
SELECT 
    'After Fix - Unique Constraints' as info,
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'chats' 
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 8: Test the constraint by trying to insert a duplicate
-- This should fail if the constraint is working
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
) ON CONFLICT (driver_id, admin_id) DO NOTHING
RETURNING id, driver_id, admin_id, created_at; 