-- Setup Storage Policies for licence and idcards buckets
-- This allows authenticated users to upload, view, update, and delete their documents
-- Files are typically named as: {user.id}-{timestamp}.jpg or similar

-- Note: Bucket creation should be done via Supabase Dashboard or API
-- This migration assumes the 'licence' and 'idcards' buckets already exist

-- ==============================================
-- LICENCE BUCKET POLICIES
-- ==============================================

-- Drop existing policies for licence bucket if they exist
DROP POLICY IF EXISTS "Authenticated users can upload to licence bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view licence bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update licence bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from licence bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view licence" ON storage.objects;

-- Policy 1: Allow authenticated users to upload to licence bucket
-- Files must start with the user's ID (format: {user.id}-{timestamp}.jpg)
CREATE POLICY "Authenticated users can upload to licence bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'licence' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Policy 2: Allow authenticated users to view/download from licence bucket
CREATE POLICY "Authenticated users can view licence bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'licence');

-- Policy 3: Allow authenticated users to update files in licence bucket
-- Users can only update files that start with their user ID
CREATE POLICY "Authenticated users can update licence bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'licence' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'licence' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Policy 4: Allow authenticated users to delete files from licence bucket
-- Users can only delete files that start with their user ID
CREATE POLICY "Authenticated users can delete from licence bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'licence' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- ==============================================
-- IDCARDS BUCKET POLICIES
-- ==============================================

-- Drop existing policies for idcards bucket if they exist
DROP POLICY IF EXISTS "Authenticated users can upload to idcards bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view idcards bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update idcards bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from idcards bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view idcards" ON storage.objects;

-- Policy 1: Allow authenticated users to upload to idcards bucket
-- Files must start with the user's ID (format: {user.id}-{timestamp}.jpg)
CREATE POLICY "Authenticated users can upload to idcards bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'idcards' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Policy 2: Allow authenticated users to view/download from idcards bucket
CREATE POLICY "Authenticated users can view idcards bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'idcards');

-- Policy 3: Allow authenticated users to update files in idcards bucket
-- Users can only update files that start with their user ID
CREATE POLICY "Authenticated users can update idcards bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'idcards' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'idcards' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Policy 4: Allow authenticated users to delete files from idcards bucket
-- Users can only delete files that start with their user ID
CREATE POLICY "Authenticated users can delete from idcards bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'idcards' AND
  ((storage.foldername(name))[1] = auth.uid()::text OR
   name LIKE auth.uid()::text || '-%')
);

-- Optional: If you want documents to be publicly accessible (not recommended for sensitive documents)
-- Uncomment these policies if needed
/*
CREATE POLICY "Public can view licence"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'licence');

CREATE POLICY "Public can view idcards"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'idcards');
*/

