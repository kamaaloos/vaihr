-- Drop existing table if it exists
DROP TABLE IF EXISTS terms;

-- Create terms table
CREATE TABLE terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language TEXT NOT NULL CHECK (language IN ('english', 'finnish')),
    content TEXT NOT NULL,
    version TEXT NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language)
);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_terms_updated_at
    BEFORE UPDATE ON terms
    FOR EACH ROW
    EXECUTE FUNCTION update_terms_updated_at();

-- Enable RLS
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view terms" ON terms;
DROP POLICY IF EXISTS "Only admins can modify terms" ON terms;
DROP POLICY IF EXISTS "Drivers and admins can view terms" ON terms;
DROP POLICY IF EXISTS "Only admins can insert terms" ON terms;
DROP POLICY IF EXISTS "Only admins can update terms" ON terms;
DROP POLICY IF EXISTS "Only admins can delete terms" ON terms;
DROP POLICY IF EXISTS "Service role has full access" ON terms;

-- Create RLS Policies
CREATE POLICY "Service role full access"
    ON terms
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Drivers and admins can view terms"
    ON terms FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND (users.role = 'driver' OR users.role = 'admin')
        )
    );

CREATE POLICY "Only admins can insert terms"
    ON terms FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update terms"
    ON terms FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete terms"
    ON terms FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    ); 