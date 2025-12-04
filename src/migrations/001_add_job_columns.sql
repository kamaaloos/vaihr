-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Add missing columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS admin_id TEXT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add firebase_id column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS firebase_id TEXT UNIQUE;

-- Create a trigger function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better query performance
DROP INDEX IF EXISTS idx_jobs_admin_id;
DROP INDEX IF EXISTS idx_jobs_driver_id;
DROP INDEX IF EXISTS idx_jobs_status;
DROP INDEX IF EXISTS idx_users_firebase_id;

CREATE INDEX IF NOT EXISTS idx_jobs_admin_id ON jobs(admin_id);
CREATE INDEX IF NOT EXISTS idx_jobs_driver_id ON jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_users_firebase_id ON users(firebase_id); 