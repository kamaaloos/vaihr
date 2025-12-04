-- Ensure phone_number column exists in profiles table
-- This fixes the "Could not find the 'phone_number' column" error

DO $$
BEGIN
    -- Add phone_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
        RAISE NOTICE 'Added phone_number column to profiles table';
    ELSE
        RAISE NOTICE 'phone_number column already exists in profiles table';
    END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

