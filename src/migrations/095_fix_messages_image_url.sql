-- Ensure messages.image_url column exists to fix runtime errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.messages
        ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Added image_url column to public.messages';
    ELSE
        RAISE NOTICE 'image_url column already exists on public.messages';
    END IF;
END
$$;


