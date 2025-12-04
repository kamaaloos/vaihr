-- Expand profiles table to include all profile fields
-- This allows drivers to view, update, and delete all their profile data

DO $$
BEGIN
    -- Add phone_number column if it doesn't exist (should exist from initial table creation, but ensure it)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
        RAISE NOTICE 'Added phone_number column to profiles table';
    END IF;

    -- Add driver_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'driver_type'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN driver_type TEXT;
        RAISE NOTICE 'Added driver_type column to profiles table';
    END IF;

    -- Add license_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'license_type'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN license_type TEXT;
        RAISE NOTICE 'Added license_type column to profiles table';
    END IF;

    -- Add taxi_permit_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'taxi_permit_number'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN taxi_permit_number TEXT;
        RAISE NOTICE 'Added taxi_permit_number column to profiles table';
    END IF;

    -- Add skills column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'skills'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN skills TEXT;
        RAISE NOTICE 'Added skills column to profiles table';
    END IF;

    -- Add experience column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'experience'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN experience TEXT;
        RAISE NOTICE 'Added experience column to profiles table';
    END IF;

    -- Add license_front_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'license_front_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN license_front_url TEXT;
        RAISE NOTICE 'Added license_front_url column to profiles table';
    END IF;

    -- Add license_back_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'license_back_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN license_back_url TEXT;
        RAISE NOTICE 'Added license_back_url column to profiles table';
    END IF;

    -- Add idcard_front_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'idcard_front_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN idcard_front_url TEXT;
        RAISE NOTICE 'Added idcard_front_url column to profiles table';
    END IF;

    -- Add idcard_back_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'idcard_back_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN idcard_back_url TEXT;
        RAISE NOTICE 'Added idcard_back_url column to profiles table';
    END IF;

    -- Add bank_info column (JSONB) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bank_info'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN bank_info JSONB;
        RAISE NOTICE 'Added bank_info column to profiles table';
    END IF;

    -- Add company_info column (JSONB) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'company_info'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN company_info JSONB;
        RAISE NOTICE 'Added company_info column to profiles table';
    END IF;

    -- Update address column to JSONB if it's currently TEXT
    -- First check if address exists and is TEXT, then convert to JSONB
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' 
        AND column_name = 'address' AND data_type = 'text'
    ) THEN
        -- Convert existing TEXT address to JSONB
        ALTER TABLE public.profiles 
        ALTER COLUMN address TYPE JSONB USING address::jsonb;
        RAISE NOTICE 'Converted address column from TEXT to JSONB';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'address'
    ) THEN
        -- Add address as JSONB if it doesn't exist
        ALTER TABLE public.profiles ADD COLUMN address JSONB;
        RAISE NOTICE 'Added address column as JSONB to profiles table';
    END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

