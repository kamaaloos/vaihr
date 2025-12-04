-- Fix incorrect role for admin user
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}' 
WHERE id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Create missing status record for driver
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    updated_at
)
VALUES (
    '36a28a98-995f-4452-86fa-7d8bcc9ed0f1',
    false,
    'web',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;

-- Add a trigger to ensure new drivers get a status record
CREATE OR REPLACE FUNCTION ensure_driver_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new driver, create their status record
    IF NEW.raw_user_meta_data->>'role' = 'driver' THEN
        INSERT INTO user_status (
            user_id,
            is_online,
            platform,
            last_seen,
            updated_at
        )
        VALUES (
            NEW.id,
            false,
            'web',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure driver status records
DROP TRIGGER IF EXISTS ensure_driver_status_trigger ON auth.users;
CREATE TRIGGER ensure_driver_status_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_driver_status(); 