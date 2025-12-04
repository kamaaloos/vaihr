-- Add foreign key constraints to chats table
ALTER TABLE chats
    ADD CONSTRAINT fk_driver_id
    FOREIGN KEY (driver_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

ALTER TABLE chats
    ADD CONSTRAINT fk_admin_id
    FOREIGN KEY (admin_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_driver_id ON chats(driver_id);
CREATE INDEX IF NOT EXISTS idx_chats_admin_id ON chats(admin_id);

-- Create a view for chat relationships
CREATE OR REPLACE VIEW chat_relationships AS
SELECT 
    c.*,
    d.email as driver_email,
    d.raw_user_meta_data->>'full_name' as driver_name,
    a.email as admin_email,
    a.raw_user_meta_data->>'full_name' as admin_name
FROM chats c
LEFT JOIN auth.users d ON c.driver_id = d.id
LEFT JOIN auth.users a ON c.admin_id = a.id;

-- Grant access to the view
GRANT SELECT ON chat_relationships TO authenticated; 