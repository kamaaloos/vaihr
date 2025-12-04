-- Drop the existing function
DROP FUNCTION IF EXISTS update_user_push_token;

-- Create the updated function with better error handling and logging
CREATE OR REPLACE FUNCTION update_user_push_token(
    p_user_id TEXT,
    p_token TEXT
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result users;
    v_old_token TEXT;
BEGIN
    -- First get the current token
    SELECT expo_push_token INTO v_old_token
    FROM users
    WHERE id::text = p_user_id;

    -- Log the update attempt
    RAISE NOTICE 'Updating push token for user %. Old token: %. New token: %', p_user_id, v_old_token, p_token;

    -- Update the user record
    UPDATE users
    SET 
        expo_push_token = p_token,
        updated_at = NOW()
    WHERE id::text = p_user_id
    RETURNING * INTO v_result;

    -- Check if update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with ID: %', p_user_id;
    END IF;

    -- Verify the update
    IF v_result.expo_push_token IS DISTINCT FROM p_token THEN
        RAISE EXCEPTION 'Token verification failed. Expected: %, Actual: %', p_token, v_result.expo_push_token;
    END IF;

    -- Log successful update
    RAISE NOTICE 'Successfully updated push token for user %', p_user_id;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    RAISE NOTICE 'Error updating push token: %', SQLERRM;
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_push_token TO authenticated;

-- Ensure the function owner has proper permissions
ALTER FUNCTION update_user_push_token OWNER TO postgres;

-- Add an index on expo_push_token if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users(expo_push_token);

-- Ensure the expo_push_token column exists and is nullable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'expo_push_token'
    ) THEN
        ALTER TABLE users ADD COLUMN expo_push_token TEXT;
    END IF;
END $$;

-- Add RLS policy for users to update their own push token
DROP POLICY IF EXISTS "Users can update their own push token" ON users;
CREATE POLICY "Users can update their own push token"
    ON users
    FOR UPDATE
    TO authenticated
    USING (id::text = auth.uid()::text)
    WITH CHECK (id::text = auth.uid()::text);

-- Create a trigger to validate push token updates
CREATE OR REPLACE FUNCTION validate_push_token_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow updating expo_push_token and updated_at
    IF NEW.id::text = auth.uid()::text AND (
        OLD.expo_push_token IS DISTINCT FROM NEW.expo_push_token OR
        OLD.updated_at IS DISTINCT FROM NEW.updated_at
    ) THEN
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for push token updates
DROP TRIGGER IF EXISTS validate_push_token_update_trigger ON users;
CREATE TRIGGER validate_push_token_update_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_push_token_update(); 