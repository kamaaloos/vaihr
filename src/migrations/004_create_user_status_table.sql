-- Drop dependent function first
DROP FUNCTION IF EXISTS upsert_user_status(boolean, text, text);

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
DROP FUNCTION IF EXISTS update_user_status_updated_at();

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_user_status_user_id;
DROP INDEX IF EXISTS idx_user_status_online;
DROP INDEX IF EXISTS idx_user_status_last_active;

-- Drop existing table if it exists
DROP TABLE IF EXISTS user_status CASCADE;

-- Create user_status table
CREATE TABLE user_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_token TEXT,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_user_status_updated_at();

-- Create upsert function
CREATE OR REPLACE FUNCTION upsert_user_status(
    p_is_online BOOLEAN,
    p_device_token TEXT,
    p_platform TEXT
)
RETURNS user_status AS $$
DECLARE
    v_user_status user_status;
BEGIN
    INSERT INTO user_status (user_id, is_online, device_token, platform, last_seen)
    VALUES (auth.uid(), p_is_online, p_device_token, p_platform, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        is_online = p_is_online,
        device_token = p_device_token,
        platform = p_platform,
        last_seen = CURRENT_TIMESTAMP
    RETURNING * INTO v_user_status;
    
    RETURN v_user_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all user statuses" ON user_status;
DROP POLICY IF EXISTS "Users can update their own status" ON user_status;
DROP POLICY IF EXISTS "Users can insert their own status" ON user_status;

-- Create RLS Policies
CREATE POLICY "Users can view their own status"
    ON user_status FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own status"
    ON user_status FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own status"
    ON user_status FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create indexes after table creation
CREATE INDEX idx_user_status_user_id ON user_status(user_id);
CREATE INDEX idx_user_status_is_online ON user_status(is_online);
CREATE INDEX idx_user_status_last_seen ON user_status(last_seen); 