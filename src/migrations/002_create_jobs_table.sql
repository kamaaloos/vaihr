-- Drop dependent views first
DROP VIEW IF EXISTS chat_list;

-- Drop dependent tables first
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can see all jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers see new jobs and their own jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can create jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can update jobs" ON jobs;
DROP POLICY IF EXISTS "Drivers can accept new jobs" ON jobs;

-- Drop existing table and its dependencies
DROP TABLE IF EXISTS jobs CASCADE;

-- Create jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    date TIMESTAMP WITH TIME ZONE,
    duration TEXT,
    rate TEXT,
    status TEXT DEFAULT 'new',
    driver_id UUID,
    admin_id UUID,
    driver_name TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES auth.users(id),
    FOREIGN KEY (admin_id) REFERENCES auth.users(id)
);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobs_updated_at();

-- Create indexes
CREATE INDEX idx_jobs_admin_id ON jobs(admin_id);
CREATE INDEX idx_jobs_driver_id ON jobs(driver_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can see all jobs"
ON jobs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Drivers see new jobs and their own jobs"
ON jobs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'driver'
        AND (
            (jobs.status = 'new' AND jobs.driver_id IS NULL)
            OR jobs.driver_id = auth.uid()
        )
    )
);

CREATE POLICY "Admins can create jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Admins can update jobs"
ON jobs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Drivers can accept new jobs"
ON jobs FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'driver'
    )
    AND jobs.status = 'new'
    AND jobs.driver_id IS NULL
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'driver'
    )
    AND (
        CASE 
            WHEN jobs.status = 'new' AND jobs.driver_id IS NULL THEN
                status = 'processing' AND driver_id = auth.uid()
            ELSE false
        END
    )
); 