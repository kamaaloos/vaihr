-- Setup Storage Policies for images bucket
-- This allows authenticated users to upload, view, update, and delete images
-- Files are named as: {user.id}-{timestamp}.jpg

-- Note: Bucket creation should be done via Supabase Dashboard or API
-- This migration assumes the 'images' bucket already exists

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload to images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

-- Policy 1: Allow authenticated users to upload images
-- Files must start with the user's ID (format: {user.id}-{timestamp}.jpg)
CREATE POLICY "Authenticated users can upload to images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  (name LIKE auth.uid()::text || '-%')
);

-- Policy 2: Allow authenticated users to view/download images
CREATE POLICY "Authenticated users can view images bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'images');

-- Policy 3: Allow authenticated users to update images
-- Users can only update files that start with their user ID
CREATE POLICY "Authenticated users can update images bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'images' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Policy 4: Allow authenticated users to delete images
-- Users can only delete files that start with their user ID
CREATE POLICY "Authenticated users can delete from images bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'images' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Optional: If you want images to be publicly accessible (for profile images)
-- Uncomment this policy to allow public read access
/*
CREATE POLICY "Public can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');
*/

