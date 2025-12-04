-- Add license and ID card URL columns to users table
-- These columns store the URLs of uploaded license and ID card images

DO $$
BEGIN
    -- Add license_front_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'license_front_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN license_front_url TEXT;
        RAISE NOTICE 'Added license_front_url column to users table';
    END IF;

    -- Add license_back_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'license_back_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN license_back_url TEXT;
        RAISE NOTICE 'Added license_back_url column to users table';
    END IF;

    -- Add idcard_front_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'idcard_front_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN idcard_front_url TEXT;
        RAISE NOTICE 'Added idcard_front_url column to users table';
    END IF;

    -- Add idcard_back_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'idcard_back_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN idcard_back_url TEXT;
        RAISE NOTICE 'Added idcard_back_url column to users table';
    END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

