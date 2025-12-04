-- Add policy for admins to create user status records
CREATE POLICY "Admins can create user status records"
    ON user_status FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 