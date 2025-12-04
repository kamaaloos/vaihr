-- Simple Step-by-Step Fix for User Registration
-- Run these commands one by one in your Supabase SQL Editor

-- Step 1: Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- Step 3: Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Step 4: Create simple permissive policy
CREATE POLICY "Allow authenticated users to insert" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- Step 5: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 6: Reload schema
NOTIFY pgrst, 'reload schema';

