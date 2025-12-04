-- Add data column to notifications table if it doesn't exist
-- This column is needed to store additional notification metadata (jobId, status changes, etc.)

-- Check if data column exists, if not add it
DO $$
BEGIN
    -- Check if data column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        -- Add the data column
        ALTER TABLE notifications 
        ADD COLUMN data JSONB;
        
        RAISE NOTICE '✅ Added data column to notifications table';
    ELSE
        RAISE NOTICE 'ℹ️ data column already exists in notifications table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    'Verification' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'data';

