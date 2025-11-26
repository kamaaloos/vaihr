-- Drop existing policies first
DROP POLICY IF EXISTS "Service role can read id_mappings" ON id_mappings;
DROP POLICY IF EXISTS "Service role can insert/update id_mappings" ON id_mappings;
DROP POLICY IF EXISTS "Service role can update id_mappings" ON id_mappings;

-- Create id_mappings table to store old Firebase IDs to new Supabase UUIDs mappings
CREATE TABLE IF NOT EXISTS id_mappings (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_id_mappings_new_id ON id_mappings(new_id);

-- Enable RLS but allow service role access
ALTER TABLE id_mappings ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to read mappings
CREATE POLICY "Service role can read id_mappings"
ON id_mappings FOR SELECT
TO authenticated
USING (true);

-- Policy to allow service role to insert/update mappings
CREATE POLICY "Service role can insert/update id_mappings"
ON id_mappings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can update id_mappings"
ON id_mappings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true); 