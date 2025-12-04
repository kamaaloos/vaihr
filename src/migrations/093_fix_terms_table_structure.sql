-- Fix terms table structure to ensure it has the correct columns
-- This migration ensures the terms table has the language column that the app expects

-- First, check if the terms table exists and what structure it has
-- Drop the existing terms table if it exists (since we need to recreate it with correct structure)
DROP TABLE IF EXISTS terms CASCADE;

-- Create the terms table with the correct structure
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

-- Insert default terms of service content
INSERT INTO terms (language, content, version) VALUES 
('english', 
'# Terms of Service

## 1. Acceptance of Terms
By using this application, you agree to be bound by these Terms of Service.

## 2. Description of Service
This application provides a platform for connecting drivers with job opportunities.

## 3. User Responsibilities
- Users must provide accurate information
- Users must comply with all applicable laws
- Users must not misuse the platform

## 4. Privacy
Your privacy is important to us. Please review our Privacy Policy.

## 5. Limitation of Liability
The service is provided "as is" without warranties of any kind.

## 6. Changes to Terms
We reserve the right to modify these terms at any time.

## 7. Contact Information
For questions about these terms, please contact us.

Last updated: ' || CURRENT_TIMESTAMP::date, 
'1.0.0'),

('finnish', 
'# Käyttöehdot

## 1. Ehtojen hyväksyminen
Käyttämällä tätä sovellusta sitoudut noudattamaan näitä käyttöehtoja.

## 2. Palvelun kuvaus
Tämä sovellus tarjoaa alustan kuljettajien ja työmahdollisuuksien yhdistämiseen.

## 3. Käyttäjien vastuut
- Käyttäjien on annettava tarkkoja tietoja
- Käyttäjien on noudatettava kaikkia soveltuvia lakeja
- Käyttäjien ei saa väärinkäyttää alustaa

## 4. Yksityisyys
Yksityisyytesi on meille tärkeää. Tutustu tietosuojakäytäntöömme.

## 5. Vastuun rajoitus
Palvelua tarjotaan "sellaisenaan" ilman minkäänlaisia takuita.

## 6. Ehtojen muutokset
Pidätämme oikeuden muuttaa näitä ehtoja milloin tahansa.

## 7. Yhteystiedot
Kysymyksistä näistä ehdoista, ota yhteyttä meihin.

Päivitetty: ' || CURRENT_TIMESTAMP::date, 
'1.0.0');

-- Grant necessary permissions
GRANT SELECT ON terms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON terms TO authenticated;









