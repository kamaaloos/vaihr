-- Drop existing cleanup function
DROP FUNCTION IF EXISTS cleanup_stale_user_statuses;

-- Create or replace the cleanup function
CREATE OR REPLACE FUNCTION cleanup_stale_statuses()
RETURNS void AS $$
DECLARE
    v_user_ids text[];
BEGIN
    -- Get the list of user IDs that need to be marked offline
    SELECT ARRAY_AGG(user_id::text)
    INTO v_user_ids
    FROM user_status
    WHERE is_online = true
    AND last_seen < CURRENT_TIMESTAMP - INTERVAL '5 minutes';

    -- Update user_status table
    UPDATE user_status 
    SET is_online = false 
    WHERE is_online = true
    AND last_seen < CURRENT_TIMESTAMP - INTERVAL '5 minutes';

    -- Update users table through RLS policy
    IF v_user_ids IS NOT NULL THEN
        UPDATE auth.users 
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{is_online}',
            'false'::jsonb
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id::text = ANY(v_user_ids);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to periodically cleanup stale statuses
CREATE OR REPLACE FUNCTION trigger_cleanup_stale_statuses()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if this is a system update
    IF current_setting('app.system_update', true) = 'true' THEN
        RETURN NULL;
    END IF;

    -- Set the system update flag
    PERFORM set_config('app.system_update', 'true', true);
    
    -- Perform cleanup
    PERFORM cleanup_stale_statuses();
    
    -- Reset the system update flag
    PERFORM set_config('app.system_update', 'false', true);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run cleanup periodically
DROP TRIGGER IF EXISTS cleanup_stale_statuses_trigger ON user_status;
CREATE TRIGGER cleanup_stale_statuses_trigger
    AFTER UPDATE ON user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_cleanup_stale_statuses();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_stale_statuses TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_cleanup_stale_statuses TO authenticated;

-- Enable RLS on user_status table
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own status" ON user_status;
DROP POLICY IF EXISTS "Users can update their own status" ON user_status;
DROP POLICY IF EXISTS "Users can insert their own status" ON user_status;
DROP POLICY IF EXISTS "Admins can manage all statuses" ON user_status;

-- Create new policies
CREATE POLICY "Users can view their own status"
    ON user_status FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all statuses"
    ON user_status FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Users can update their own status"
    ON user_status FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own status"
    ON user_status FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create policy for auth.users table
DROP POLICY IF EXISTS "Users can view their own data" ON auth.users;
DROP POLICY IF EXISTS "Admins can view all users" ON auth.users;

CREATE POLICY "Users can view their own data"
    ON auth.users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON auth.users FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 