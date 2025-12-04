-- Quick fix: Add driver_type column to profiles table if it doesn't exist
-- This fixes the "Could not find the 'driver_type' column" error

DO $$
BEGIN
    -- Add driver_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'driver_type'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN driver_type TEXT;
        RAISE NOTICE 'Added driver_type column to profiles table';
    ELSE
        RAISE NOTICE 'driver_type column already exists in profiles table';
    END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

