-- Enable public read access for images bucket
-- This allows profile images to be displayed without authentication
--
-- IMPORTANT: Before running this migration, you must create the 'images' bucket in Supabase Dashboard:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "images"
-- 4. Public bucket: YES (check this box)
-- 5. Click "Create bucket"
--
-- Alternatively, you can create it via the Supabase Management API or use the create-buckets.js script

-- Drop existing public policy if it exists
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

-- Create policy to allow public read access to images bucket
-- This will only work if the bucket exists and is set to public
CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
