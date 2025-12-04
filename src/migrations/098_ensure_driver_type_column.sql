-- Ensure all profile-related columns exist in users table and refresh PostgREST schema cache

DO $$
BEGIN
    -- Add driver_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'driver_type'
    ) THEN
        ALTER TABLE public.users ADD COLUMN driver_type TEXT;
        RAISE NOTICE 'Added driver_type column to users table';
    END IF;

    -- Add license_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'license_type'
    ) THEN
        ALTER TABLE public.users ADD COLUMN license_type TEXT;
        RAISE NOTICE 'Added license_type column to users table';
    END IF;

    -- Add taxi_permit_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'taxi_permit_number'
    ) THEN
        ALTER TABLE public.users ADD COLUMN taxi_permit_number TEXT;
        RAISE NOTICE 'Added taxi_permit_number column to users table';
    END IF;

    -- Add skills column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'skills'
    ) THEN
        ALTER TABLE public.users ADD COLUMN skills TEXT;
        RAISE NOTICE 'Added skills column to users table';
    END IF;

    -- Add experience column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'experience'
    ) THEN
        ALTER TABLE public.users ADD COLUMN experience TEXT;
        RAISE NOTICE 'Added experience column to users table';
    END IF;

    -- Add phone_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.users ADD COLUMN phone_number TEXT;
        RAISE NOTICE 'Added phone_number column to users table';
    END IF;

    -- Add profile_image column if it doesn't exist (or use avatar_url as fallback)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_image'
    ) THEN
        ALTER TABLE public.users ADD COLUMN profile_image TEXT;
        RAISE NOTICE 'Added profile_image column to users table';
    END IF;

    -- Add profile_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_completed'
    ) THEN
        ALTER TABLE public.users ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added profile_completed column to users table';
    END IF;
END$$;

-- Reload PostgREST schema cache so it recognizes all columns
NOTIFY pgrst, 'reload schema';

