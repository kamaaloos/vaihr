-- Fix trigger permissions for user_status table
-- This addresses common issues with trigger access to tables

-- 1. Grant necessary permissions to the trigger function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON TABLE user_status TO supabase_auth_admin;

-- 2. Update the trigger function to use explicit schema reference
CREATE OR REPLACE FUNCTION ensure_driver_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new driver, create their status record
    IF NEW.raw_user_meta_data->>'role' = 'driver' THEN
        INSERT INTO public.user_status (
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

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS ensure_driver_status_trigger ON auth.users;
CREATE TRIGGER ensure_driver_status_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_driver_status();

-- 4. Test the trigger function manually
SELECT 
  'Testing Trigger Function' as info,
  'Trigger function updated with explicit schema reference' as status; 