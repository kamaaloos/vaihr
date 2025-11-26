-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
DROP POLICY IF EXISTS "Users can update their own push token" ON users;

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

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
    ON users FOR ALL
    TO authenticated
    USING (
        coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'admin'
        OR
        coalesce(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role', '') = 'admin'
    );

-- Create policy for service role to have full access
CREATE POLICY "Service role has full access to users"
    ON users
    FOR ALL
    USING (true);

-- Create a trigger function to validate push token updates
CREATE OR REPLACE FUNCTION validate_push_token_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id::text = auth.uid()::text AND (
        (OLD.expo_push_token IS NULL AND NEW.expo_push_token IS NOT NULL)
        OR
        (OLD.expo_push_token IS NOT NULL AND NEW.expo_push_token IS NULL)
        OR
        (OLD.expo_push_token IS DISTINCT FROM NEW.expo_push_token)
    ) THEN
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for push token updates
DROP TRIGGER IF EXISTS validate_push_token_update_trigger ON users;
CREATE TRIGGER validate_push_token_update_trigger
    BEFORE UPDATE OF expo_push_token ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_push_token_update(); 