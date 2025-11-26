-- Migration to fix missing columns that are causing errors in the app
-- This addresses the "column users.online does not exist" and "column chats.last_message_time does not exist" errors

-- Step 1: Add 'online' column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'online') THEN
        ALTER TABLE public.users ADD COLUMN online BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added online column to users table.';
    ELSE
        RAISE NOTICE 'Online column already exists in users table.';
    END IF;
END
$$;

-- Step 2: Add 'last_message_time' column to chats table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'last_message_time') THEN
        ALTER TABLE public.chats ADD COLUMN last_message_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_message_time column to chats table.';
    ELSE
        RAISE NOTICE 'Last_message_time column already exists in chats table.';
    END IF;
END
$$;

-- Step 3: Update existing users to have online = false by default
UPDATE public.users 
SET online = FALSE 
WHERE online IS NULL;

-- Step 4: Create or update the trigger to sync online status between users and user_status tables
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_user_online_status ON public.user_status;
DROP FUNCTION IF EXISTS public.sync_user_online_status();

-- Create function to sync online status
CREATE OR REPLACE FUNCTION public.sync_user_online_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the users table when user_status changes
    UPDATE public.users 
    SET online = NEW.is_online 
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER sync_user_online_status
    AFTER INSERT OR UPDATE ON public.user_status
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_online_status();

-- Step 5: Create or update the reverse trigger to sync from users to user_status
DROP TRIGGER IF EXISTS sync_user_status_from_users ON public.users;
DROP FUNCTION IF EXISTS public.sync_user_status_from_users();

-- Create function to sync from users to user_status
CREATE OR REPLACE FUNCTION public.sync_user_status_from_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the user_status table when users.online changes
    INSERT INTO public.user_status (user_id, is_online, last_seen)
    VALUES (NEW.id, NEW.online, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        is_online = NEW.online,
        last_seen = CASE 
            WHEN NEW.online = TRUE THEN CURRENT_TIMESTAMP 
            ELSE user_status.last_seen 
        END;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER sync_user_status_from_users
    AFTER UPDATE OF online ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_status_from_users();

-- Step 6: Ensure user_status table has the correct structure
DO $$
BEGIN
    -- Add is_online column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_status' AND column_name = 'is_online') THEN
        ALTER TABLE public.user_status ADD COLUMN is_online BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_online column to user_status table.';
    END IF;
    
    -- Add last_seen column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_status' AND column_name = 'last_seen') THEN
        ALTER TABLE public.user_status ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added last_seen column to user_status table.';
    END IF;
END
$$;

-- Step 7: Update existing user_status records to have proper defaults
UPDATE public.user_status 
SET 
    is_online = COALESCE(is_online, FALSE),
    last_seen = COALESCE(last_seen, CURRENT_TIMESTAMP)
WHERE is_online IS NULL OR last_seen IS NULL;

-- Step 8: Ensure all users have a corresponding user_status record
INSERT INTO public.user_status (user_id, is_online, last_seen)
SELECT id, online, CURRENT_TIMESTAMP
FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.user_status)
ON CONFLICT (user_id) DO NOTHING;

-- Step 9: Fix terms table RLS policies to allow proper access
-- Drop existing policies
DROP POLICY IF EXISTS "Service role full access" ON public.terms;
DROP POLICY IF EXISTS "Drivers and admins can view terms" ON public.terms;
DROP POLICY IF EXISTS "Only admins can insert terms" ON public.terms;
DROP POLICY IF EXISTS "Only admins can update terms" ON public.terms;
DROP POLICY IF EXISTS "Only admins can delete terms" ON public.terms;

-- Create new policies with proper permissions
CREATE POLICY "Service role full access"
    ON public.terms
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can view terms"
    ON public.terms FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Only admins can insert terms"
    ON public.terms FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update terms"
    ON public.terms FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete terms"
    ON public.terms FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role = 'admin'
        )
    );

-- Step 10: Insert default terms if none exist
INSERT INTO public.terms (language, content, version, last_updated)
SELECT 'english', 
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
'1.0.0',
CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM public.terms WHERE language = 'english');

INSERT INTO public.terms (language, content, version, last_updated)
SELECT 'finnish', 
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
'1.0.0',
CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM public.terms WHERE language = 'finnish');

-- Step 11: Grant necessary permissions
GRANT SELECT ON public.terms TO authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.user_status TO authenticated;
GRANT SELECT ON public.chats TO authenticated;
GRANT SELECT ON public.messages TO authenticated;

RAISE NOTICE 'Migration completed successfully - fixed missing columns and RLS policies';








