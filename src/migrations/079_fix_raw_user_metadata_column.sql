-- Fix column name mismatch for raw_user_metadata
-- This migration addresses the issue where the database has raw_user_metadata 
-- but the code expects raw_user_meta_data

-- First, check if the column exists with the wrong name
DO $$ 
BEGIN
    -- Check if raw_user_metadata exists (wrong name)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'raw_user_metadata'
    ) THEN
        RAISE NOTICE 'Found raw_user_metadata column - this needs to be renamed';
        
        -- Rename the column to the correct name
        ALTER TABLE auth.users RENAME COLUMN raw_user_metadata TO raw_user_meta_data;
        RAISE NOTICE 'Successfully renamed raw_user_metadata to raw_user_meta_data';
    ELSE
        RAISE NOTICE 'raw_user_metadata column does not exist - checking for correct column name';
    END IF;
    
    -- Verify the correct column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'raw_user_meta_data'
    ) THEN
        RAISE NOTICE 'raw_user_meta_data column exists and is correctly named';
    ELSE
        RAISE NOTICE 'WARNING: raw_user_meta_data column does not exist';
    END IF;
END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the fix
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'raw_user_meta_data'
    ) THEN
        RAISE NOTICE 'SUCCESS: Column name fix verified - raw_user_meta_data exists';
    ELSE
        RAISE NOTICE 'ERROR: Column name fix failed - raw_user_meta_data still missing';
    END IF;
END $$; 