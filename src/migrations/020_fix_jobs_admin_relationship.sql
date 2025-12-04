-- Add foreign key constraint for admin_id in jobs table
ALTER TABLE jobs
    ADD CONSTRAINT fk_jobs_admin
    FOREIGN KEY (admin_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Create a view to expose job relationships
CREATE OR REPLACE VIEW jobs_with_admin AS
SELECT 
    j.*,
    u.raw_user_meta_data->>'name' as admin_name,
    u.raw_user_meta_data->>'avatar_url' as admin_avatar_url
FROM jobs j
LEFT JOIN auth.users u ON j.admin_id = u.id;

-- Enable RLS on jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for jobs table
DROP POLICY IF EXISTS "Public can view jobs" ON jobs;
CREATE POLICY "Public can view jobs" ON jobs
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage jobs" ON jobs;
CREATE POLICY "Admins can manage jobs" ON jobs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT ON jobs_with_admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated; 