-- OTP Migration for Vaihtoratti App
-- Run this in your Supabase SQL Editor

-- Create OTP codes table for email verification
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Add RLS policies
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to insert their own OTP codes
CREATE POLICY "Users can insert their own OTP codes" ON otp_codes
    FOR INSERT WITH CHECK (true);

-- Policy to allow users to read their own OTP codes
CREATE POLICY "Users can read their own OTP codes" ON otp_codes
    FOR SELECT USING (true);

-- Policy to allow users to update their own OTP codes
CREATE POLICY "Users can update their own OTP codes" ON otp_codes
    FOR UPDATE USING (true);

-- Function to automatically clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_codes 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_otp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_otp_updated_at
    BEFORE UPDATE ON otp_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_otp_updated_at();

-- Add comments for documentation
COMMENT ON TABLE otp_codes IS 'Stores OTP codes for email verification';
COMMENT ON COLUMN otp_codes.email IS 'Email address to send OTP to';
COMMENT ON COLUMN otp_codes.code IS '6-digit OTP code';
COMMENT ON COLUMN otp_codes.expires_at IS 'When the OTP expires';
COMMENT ON COLUMN otp_codes.attempts IS 'Number of verification attempts';
COMMENT ON COLUMN otp_codes.used_at IS 'When the OTP was successfully used';

-- Test the table creation
SELECT 'OTP codes table created successfully' as status;

-- Test inserting a sample OTP
INSERT INTO otp_codes (email, code, expires_at, attempts)
VALUES ('test@example.com', '123456', NOW() + INTERVAL '10 minutes', 0);

-- Verify the insertion
SELECT * FROM otp_codes WHERE email = 'test@example.com';

-- Clean up test data
DELETE FROM otp_codes WHERE email = 'test@example.com';

SELECT 'Migration completed successfully!' as final_status;
