-- First drop the view that depends on the columns
DROP VIEW IF EXISTS jobs_with_admin CASCADE;
DROP VIEW IF EXISTS chat_relationships CASCADE;
DROP VIEW IF EXISTS chat_list CASCADE;

-- Drop ALL policies on the jobs table to avoid missing any
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop policies on jobs table
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'jobs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON jobs', pol.policyname);
    END LOOP;
    
    -- Drop policies on invoices table that might reference jobs columns
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'invoices'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON invoices', pol.policyname);
    END LOOP;
END $$;

-- Drop conflicting constraints
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_admin_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_driver_id_fkey;

-- Make sure admin_id column has the right type
ALTER TABLE jobs 
    ALTER COLUMN admin_id TYPE UUID USING admin_id::UUID;

-- Make sure driver_id column has the right type (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE jobs 
        ALTER COLUMN driver_id TYPE UUID USING 
        CASE 
            WHEN driver_id IS NULL THEN NULL
            ELSE driver_id::UUID
        END;
    END IF;
END $$;

-- Add foreign key constraints
ALTER TABLE jobs 
    ADD CONSTRAINT jobs_admin_id_fkey 
    FOREIGN KEY (admin_id) 
    REFERENCES auth.users(id);

-- Add foreign key for driver_id if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_driver_id_fkey 
        FOREIGN KEY (driver_id) 
        REFERENCES auth.users(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_admin_id ON jobs(admin_id);
CREATE INDEX IF NOT EXISTS idx_jobs_driver_id ON jobs(driver_id);

-- Recreate the view to ensure it has up-to-date schema information
CREATE VIEW jobs_with_admin AS
SELECT 
    j.*,  -- All columns from jobs
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    u.raw_user_meta_data->>'avatar_url' as admin_avatar_url
FROM 
    jobs j
LEFT JOIN 
    auth.users u ON j.admin_id = u.id;

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated;

-- Recreate the policies for jobs table
-- Create a policy for selecting jobs (anyone can view)
CREATE POLICY jobs_select_policy ON jobs
    FOR SELECT
    USING (true);

-- Create a policy for inserting jobs (authenticated users can create)
CREATE POLICY jobs_insert_policy ON jobs
    FOR INSERT
    WITH CHECK (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a policy for updating jobs (only admin of the job or admin role can update)
CREATE POLICY jobs_update_policy ON jobs
    FOR UPDATE
    USING (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a policy for deleting jobs (only admin of the job or admin role can delete)
CREATE POLICY jobs_delete_policy ON jobs
    FOR DELETE
    USING (
        -- User is the admin for this job
        auth.uid() = admin_id OR
        -- User is an admin role
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create a policy for drivers to accept new jobs
CREATE POLICY "Drivers can accept new jobs" ON jobs
    FOR UPDATE
    USING (
        -- User is a driver
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'driver'
        )
    )
    WITH CHECK (
        -- Job is new status
        status = 'new' AND
        -- Driver ID is being set to the current user ID
        driver_id = auth.uid()
    );

-- Recreate the policy for invoices
CREATE POLICY "Drivers can create invoices for completed jobs" ON invoices
    FOR INSERT
    WITH CHECK (
        -- User is a driver
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'driver'
        ) AND
        -- Driver ID matches the current user ID
        driver_id = auth.uid() AND
        -- Referenced job exists and is completed
        EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_id
            AND jobs.status = 'completed'
            AND jobs.driver_id = auth.uid()
        )
    );

-- Recreate the chat-related views if they existed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_catalog.pg_tables 
        WHERE tablename = 'chats'
    ) THEN
        -- Recreate chat_relationships view
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

        GRANT SELECT ON chat_relationships TO authenticated;

        -- Recreate chat_list view
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

        GRANT SELECT ON chat_list TO authenticated;
    END IF;
END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 