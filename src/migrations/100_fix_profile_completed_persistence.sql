-- Fix profile_completed persistence issue
-- This ensures profile_completed is properly set for users who have completed profiles

-- Step 1: Ensure profile_completed column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_completed'
    ) THEN
        ALTER TABLE public.users ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added profile_completed column to users table';
    END IF;
END$$;

-- Step 2: Set profile_completed = true for users who have profiles in the profiles table
-- This catches users who completed profiles before the column existed
UPDATE public.users u
SET profile_completed = true
WHERE EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = u.id
    AND (p.avatar_url IS NOT NULL OR p.driver_type IS NOT NULL)
)
AND (u.profile_completed IS NULL OR u.profile_completed = false);

-- Step 3: Set profile_completed = true for users who have driver_type set
-- (indicates they completed the profile form)
UPDATE public.users
SET profile_completed = true
WHERE driver_type IS NOT NULL
AND driver_type IN ('individual', 'company')
AND (profile_completed IS NULL OR profile_completed = false);

-- Step 4: Ensure profile_completed cannot be NULL (set default for any remaining NULLs)
UPDATE public.users
SET profile_completed = false
WHERE profile_completed IS NULL;

-- Step 5: Add NOT NULL constraint to prevent future NULL values
ALTER TABLE public.users 
ALTER COLUMN profile_completed SET NOT NULL,
ALTER COLUMN profile_completed SET DEFAULT false;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

