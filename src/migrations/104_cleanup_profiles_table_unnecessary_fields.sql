-- Clean up profiles table by removing unnecessary fields
-- Remove: first_name, last_name, bio, location, gender, date_of_birth, user_id
-- Keep only fields needed for driver profiles

DO $$
BEGIN
    -- Drop first_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN first_name;
        RAISE NOTICE 'Dropped first_name column from profiles table';
    END IF;

    -- Drop last_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN last_name;
        RAISE NOTICE 'Dropped last_name column from profiles table';
    END IF;

    -- Drop bio column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN bio;
        RAISE NOTICE 'Dropped bio column from profiles table';
    END IF;

    -- Drop location column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN location;
        RAISE NOTICE 'Dropped location column from profiles table';
    END IF;

    -- Drop gender column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gender'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN gender;
        RAISE NOTICE 'Dropped gender column from profiles table';
    END IF;

    -- Drop date_of_birth column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'date_of_birth'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN date_of_birth;
        RAISE NOTICE 'Dropped date_of_birth column from profiles table';
    END IF;

    -- Drop user_id column if it exists (id already references auth.users, so user_id is redundant)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) THEN
        -- Drop ALL policies on profiles table first (we'll recreate them)
        -- This ensures we catch any policy that might reference user_id
        DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
        
        -- Check if there's a foreign key constraint on user_id
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'profiles'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%user_id%'
        ) THEN
            -- Drop the foreign key constraint first
            ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
        END IF;
        
        -- Drop the column with CASCADE to handle any remaining dependencies
        ALTER TABLE public.profiles DROP COLUMN user_id CASCADE;
        RAISE NOTICE 'Dropped user_id column from profiles table';
        
        -- Recreate the policies using id instead of user_id
        CREATE POLICY "Users can view any profile"
            ON public.profiles FOR SELECT
            TO authenticated
            USING (true);

        CREATE POLICY "Users can update their own profile"
            ON public.profiles FOR UPDATE
            TO authenticated
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);

        CREATE POLICY "Users can insert their own profile"
            ON public.profiles FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = id);
            
        RAISE NOTICE 'Recreated RLS policies using id instead of user_id';
    END IF;

    -- Drop phone column if it exists (we use phone_number instead)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
        )
    ) THEN
        -- Only drop if phone_number doesn't exist (to avoid data loss)
        ALTER TABLE public.profiles DROP COLUMN phone;
        RAISE NOTICE 'Dropped phone column from profiles table (phone_number exists)';
    END IF;
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

