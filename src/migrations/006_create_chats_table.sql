-- Drop existing policies for messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Drop existing policies for chats
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can create chats they're part of" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

-- Create chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, driver_id, admin_id)
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    image_url TEXT,
    read BOOLEAN DEFAULT false,
    delivered BOOLEAN DEFAULT false,
    deleted BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_chat_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_tables_updated_at();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_tables_updated_at();

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats
CREATE POLICY "Users can view their own chats"
    ON chats FOR SELECT
    TO authenticated
    USING (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id
    );

CREATE POLICY "Users can create chats they're part of"
    ON chats FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id
    );

CREATE POLICY "Users can update their own chats"
    ON chats FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id
    )
    WITH CHECK (
        auth.uid() = driver_id OR 
        auth.uid() = admin_id
    );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their chats"
    ON messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND (chats.driver_id = auth.uid() OR chats.admin_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert messages in their chats"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = chat_id
            AND (chats.driver_id = auth.uid() OR chats.admin_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );

CREATE POLICY "Users can update their own messages"
    ON messages FOR UPDATE
    TO authenticated
    USING (
        sender_id = auth.uid()
    )
    WITH CHECK (
        sender_id = auth.uid()
    );

CREATE POLICY "Users can delete their own messages"
    ON messages FOR DELETE
    TO authenticated
    USING (
        sender_id = auth.uid()
    );

-- Create indexes for better performance
CREATE INDEX idx_chats_job_id ON chats(job_id);
CREATE INDEX idx_chats_driver_id ON chats(driver_id);
CREATE INDEX idx_chats_admin_id ON chats(admin_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Create view for chat list with admin information
CREATE OR REPLACE VIEW chat_list AS
SELECT 
    c.*,
    p.driver_type as driver_type,
    p.avatar_url as admin_avatar_url,
    j.title as job_title,
    j.description as job_description,
    j.status as job_status,
    j.date as job_date
FROM chats c
LEFT JOIN jobs j ON c.job_id = j.id
LEFT JOIN profiles p ON c.admin_id = p.id; 