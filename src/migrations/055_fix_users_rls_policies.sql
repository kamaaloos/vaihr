-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
DROP POLICY IF EXISTS "Users can update their own push token" ON users;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    TO authenticated
    USING (id::text = auth.uid()::text);

-- Create policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    TO authenticated
    USING (id::text = auth.uid()::text)
    WITH CHECK (id::text = auth.uid()::text);

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
    ON users FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create policy for service role to have full access
CREATE POLICY "Service role has full access to users"
    ON users
    FOR ALL
    USING (true);

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 