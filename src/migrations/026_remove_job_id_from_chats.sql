-- First drop the dependent views
DROP VIEW IF EXISTS chat_list CASCADE;
DROP VIEW IF EXISTS chat_relationships CASCADE;

-- Remove job_id column from chats table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chats' 
        AND column_name = 'job_id'
    ) THEN
        ALTER TABLE chats DROP COLUMN job_id;
    END IF;
END $$;

-- Recreate the chat_relationships view without job_id
CREATE OR REPLACE VIEW chat_relationships AS
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

-- Recreate the chat_list view without job_id (assuming its structure)
CREATE OR REPLACE VIEW chat_list AS
SELECT 
    c.id,
    c.driver_id,
    c.admin_id,
    c.last_message,
    c.last_message_time,
    c.created_at,
    c.updated_at,
    d.email as driver_email,
    d.raw_user_meta_data->>'full_name' as driver_name,
    a.email as admin_email,
    a.raw_user_meta_data->>'full_name' as admin_name
FROM chats c
LEFT JOIN auth.users d ON c.driver_id = d.id
LEFT JOIN auth.users a ON c.admin_id = a.id;

-- Grant access to the views
GRANT SELECT ON chat_relationships TO authenticated;
GRANT SELECT ON chat_list TO authenticated; 