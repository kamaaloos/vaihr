-- Create a trigger function to sync user data from auth.users to users table
CREATE OR REPLACE FUNCTION sync_auth_user_to_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Extract user data from raw_user_meta_data
    INSERT INTO users (
        id,
        email,
        name,
        role,
        phone_number,
        address,
        company_info,
        bank_info,
        expo_push_token,
        avatar_url,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'driver'),
        NEW.raw_user_meta_data->>'phone',
        CASE 
            WHEN NEW.raw_user_meta_data->>'address' IS NOT NULL 
            THEN NEW.raw_user_meta_data->'address'
            ELSE NULL
        END,
        CASE 
            WHEN NEW.raw_user_meta_data->>'companyInfo' IS NOT NULL 
            THEN NEW.raw_user_meta_data->'companyInfo'
            ELSE NULL
        END,
        CASE 
            WHEN NEW.raw_user_meta_data->>'bankInfo' IS NOT NULL 
            THEN NEW.raw_user_meta_data->'bankInfo'
            ELSE NULL
        END,
        NEW.raw_user_meta_data->>'expoPushToken',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.created_at,
        NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone_number = EXCLUDED.phone_number,
        address = EXCLUDED.address,
        company_info = EXCLUDED.company_info,
        bank_info = EXCLUDED.bank_info,
        expo_push_token = EXCLUDED.expo_push_token,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = EXCLUDED.updated_at;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in sync_auth_user_to_users: %', SQLERRM;
        RETURN NEW; -- Continue with the operation even if sync fails
END;
$$;

-- Create trigger to sync on INSERT
DROP TRIGGER IF EXISTS sync_auth_user_insert_trigger ON auth.users;
CREATE TRIGGER sync_auth_user_insert_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_auth_user_to_users();

-- Create trigger to sync on UPDATE
DROP TRIGGER IF EXISTS sync_auth_user_update_trigger ON auth.users;
CREATE TRIGGER sync_auth_user_update_trigger
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_auth_user_to_users();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_auth_user_to_users() TO authenticated;
ALTER FUNCTION sync_auth_user_to_users() OWNER TO postgres;

-- Sync existing users from auth.users to users table
INSERT INTO users (
    id,
    email,
    name,
    role,
    phone_number,
    address,
    company_info,
    bank_info,
    expo_push_token,
    avatar_url,
    created_at,
    updated_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', au.email),
    COALESCE(au.raw_user_meta_data->>'role', 'driver'),
    au.raw_user_meta_data->>'phone',
    CASE 
        WHEN au.raw_user_meta_data->>'address' IS NOT NULL 
        THEN au.raw_user_meta_data->'address'
        ELSE NULL
    END,
    CASE 
        WHEN au.raw_user_meta_data->>'companyInfo' IS NOT NULL 
        THEN au.raw_user_meta_data->'companyInfo'
        ELSE NULL
    END,
    CASE 
        WHEN au.raw_user_meta_data->>'bankInfo' IS NOT NULL 
        THEN au.raw_user_meta_data->'bankInfo'
        ELSE NULL
    END,
    au.raw_user_meta_data->>'expoPushToken',
    au.raw_user_meta_data->>'avatar_url',
    au.created_at,
    au.updated_at
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    company_info = EXCLUDED.company_info,
    bank_info = EXCLUDED.bank_info,
    expo_push_token = EXCLUDED.expo_push_token,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 