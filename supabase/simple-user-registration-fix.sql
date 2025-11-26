-- Simple Fix for User Registration
-- Run this in your Supabase SQL Editor

-- 1. Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- 2. Create RLS policy for user registration
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid()::uuid = id);

-- 3. Create RLS policy for user viewing
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT 
    TO authenticated
    USING (auth.uid()::uuid = id);

-- 4. Create RLS policy for user updating
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (auth.uid()::uuid = id)
    WITH CHECK (auth.uid()::uuid = id);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
