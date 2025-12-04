-- Fixed User Registration Fix
-- This handles both text and UUID id columns

-- 1. Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- 2. Drop existing policies first
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- 3. Create RLS policy for user registration (handles both text and UUID)
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        CASE 
            WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND table_schema = 'public') = 'uuid'
            THEN auth.uid()::uuid = id
            ELSE auth.uid() = id
        END
    );

-- 4. Create RLS policy for user viewing
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT 
    TO authenticated
    USING (
        CASE 
            WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND table_schema = 'public') = 'uuid'
            THEN auth.uid()::uuid = id
            ELSE auth.uid() = id
        END
    );

-- 5. Create RLS policy for user updating
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (
        CASE 
            WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND table_schema = 'public') = 'uuid'
            THEN auth.uid()::uuid = id
            ELSE auth.uid() = id
        END
    )
    WITH CHECK (
        CASE 
            WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' AND table_schema = 'public') = 'uuid'
            THEN auth.uid()::uuid = id
            ELSE auth.uid() = id
        END
    );

-- 6. Alternative: Simple text-based policies (if the above doesn't work)
-- Uncomment these if you still get errors:

/*
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id::text);

CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = id::text);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id::text)
    WITH CHECK (auth.uid() = id::text);
*/

-- 7. Reload schema cache
NOTIFY pgrst, 'reload schema';

