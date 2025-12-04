-- Ensure chats table has the correct structure
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, admin_id)
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS chats_select_policy ON chats;
CREATE POLICY chats_select_policy ON chats
    FOR SELECT
    USING (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS chats_insert_policy ON chats;
CREATE POLICY chats_insert_policy ON chats
    FOR INSERT
    WITH CHECK (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS chats_update_policy ON chats;
CREATE POLICY chats_update_policy ON chats
    FOR UPDATE
    USING (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id OR
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_chats_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON chats TO authenticated;

-- Recreate the chat_relationships view with more details
DROP VIEW IF EXISTS chat_relationships;
CREATE VIEW chat_relationships AS
SELECT 
    c.*,
    d.email as driver_email,
    d.raw_user_meta_data->>'full_name' as driver_name,
    d.raw_user_meta_data->>'phone' as driver_phone,
    a.email as admin_email,
    a.raw_user_meta_data->>'full_name' as admin_name,
    ds.is_online as driver_is_online,
    ds.last_seen as driver_last_seen,
    ads.is_online as admin_is_online,
    ads.last_seen as admin_last_seen
FROM chats c
LEFT JOIN auth.users d ON c.driver_id = d.id
LEFT JOIN auth.users a ON c.admin_id = a.id
LEFT JOIN user_status ds ON c.driver_id = ds.user_id
LEFT JOIN user_status ads ON c.admin_id = ads.user_id;

-- Grant access to the view
GRANT SELECT ON chat_relationships TO authenticated; 