-- First drop all policies that reference the invoices table
DROP POLICY IF EXISTS "Drivers can view jobs related to their invoices" ON jobs;
DROP POLICY IF EXISTS "Drivers see new jobs and their own jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can do everything with invoices" ON invoices;
DROP POLICY IF EXISTS "Drivers can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Drivers can create invoices for completed jobs" ON invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP FUNCTION IF EXISTS update_invoices_updated_at() CASCADE;

-- Drop existing table if it exists
DROP TABLE IF EXISTS invoices CASCADE;

-- Create invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Drivers can create invoices for completed jobs"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = job_id
        AND jobs.driver_id = auth.uid()
        AND jobs.status = 'completed'
    )
    AND driver_id = auth.uid()
);

CREATE POLICY "Users can view their own invoices"
ON invoices FOR SELECT
TO authenticated
USING (
    driver_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Admins can update invoices"
ON invoices FOR UPDATE
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

-- Create indexes
CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_driver_id ON invoices(driver_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_payment_date ON invoices(payment_date);

-- Create basic job access policy for drivers
CREATE POLICY "Drivers see new jobs and their own jobs"
ON jobs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'driver'
        AND (
            -- Allow access to new unassigned jobs
            (jobs.status = 'new' AND jobs.driver_id IS NULL)
            -- Allow access to jobs assigned to the driver
            OR jobs.driver_id = auth.uid()::uuid
        )
    )
); 