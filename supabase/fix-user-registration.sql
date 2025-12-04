-- Fix User Registration Issues
-- This script will resolve the "Database error saving new user" error

-- Step 1: Check if users table exists and has correct structure
SELECT 
    'Users Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check RLS policies on users table
SELECT 
    'RLS Policies' as info,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
    AND schemaname = 'public';

-- Step 3: Check if users table has RLS enabled
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users' 
    AND schemaname = 'public';

-- Step 4: Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users_id_seq TO authenticated;

-- Step 5: Create or update RLS policy for user registration
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Step 6: Create or update RLS policy for user viewing
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

-- Step 7: Create or update RLS policy for user updating
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Step 8: Ensure users table has the correct structure
-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4();
    END IF;

    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.users ADD COLUMN email TEXT;
    END IF;

    -- Add name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN name TEXT;
    END IF;

    -- Add role column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Step 9: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Step 10: Verify the fix
SELECT 
    'Verification' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as users_with_email,
    COUNT(CASE WHEN role IS NOT NULL THEN 1 END) as users_with_role
FROM public.users;

-- Step 11: Test insert permission
-- This will show if the current user can insert into the users table
SELECT 
    'Permission Test' as info,
    has_table_privilege('authenticated', 'public.users', 'INSERT') as can_insert,
    has_table_privilege('authenticated', 'public.users', 'SELECT') as can_select,
    has_table_privilege('authenticated', 'public.users', 'UPDATE') as can_update;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

