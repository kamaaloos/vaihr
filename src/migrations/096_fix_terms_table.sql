-- Ensure terms table exists with required columns and refresh schema cache

-- 1) Create table if not exists
CREATE TABLE IF NOT EXISTS public.terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language TEXT NOT NULL CHECK (language IN ('english', 'finnish')),
    content TEXT NOT NULL,
    version TEXT NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language)
);

-- 2) Add any missing columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'language') THEN
        ALTER TABLE public.terms ADD COLUMN language TEXT;
        ALTER TABLE public.terms ADD CONSTRAINT terms_language_check CHECK (language IN ('english', 'finnish'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'content') THEN
        ALTER TABLE public.terms ADD COLUMN content TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'version') THEN
        ALTER TABLE public.terms ADD COLUMN version TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'last_updated') THEN
        ALTER TABLE public.terms ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'created_at') THEN
        ALTER TABLE public.terms ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'updated_at') THEN
        ALTER TABLE public.terms ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END$$;

-- 3) Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_terms_updated_at'
    ) THEN
        CREATE TRIGGER update_terms_updated_at
            BEFORE UPDATE ON public.terms
            FOR EACH ROW
            EXECUTE FUNCTION public.update_terms_updated_at();
    END IF;
END$$;

-- 4) Enable RLS and baseline policies
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terms' AND policyname = 'Service role full access'
    ) THEN
        CREATE POLICY "Service role full access"
            ON public.terms
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END$$;

-- Authenticated users can view terms
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terms' AND policyname = 'Authenticated users can view terms'
    ) THEN
        CREATE POLICY "Authenticated users can view terms"
            ON public.terms FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END$$;

-- 5) Grants
GRANT SELECT ON public.terms TO authenticated;

-- 6) Seed defaults if missing
INSERT INTO public.terms (language, content, version)
SELECT 'english', '# Terms of Service\n\nLast updated: ' || CURRENT_TIMESTAMP::date, '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM public.terms WHERE language = 'english');

INSERT INTO public.terms (language, content, version)
SELECT 'finnish', '# Käyttöehdot\n\nPäivitetty: ' || CURRENT_TIMESTAMP::date, '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM public.terms WHERE language = 'finnish');

-- 7) Ask PostgREST to reload schema cache so columns are visible immediately
NOTIFY pgrst, 'reload schema';


