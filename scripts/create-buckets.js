/**
 * Script to create required Supabase storage buckets
 * 
 * Run this script with: node scripts/create-buckets.js
 * 
 * Make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file
 * or set them as environment variables.
 */

const { createClient } = require('@supabase/supabase-js');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, use environment variables directly
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Set them in your .env file or as environment variables');
  console.error('   Example: EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const buckets = [
  {
    id: 'images',
    name: 'images',
    public: true, // Public bucket for profile images
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  },
  {
    id: 'licence',
    name: 'licence',
    public: false, // Private bucket for license images
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
  },
  {
    id: 'idcards',
    name: 'idcards',
    public: false, // Private bucket for ID card images
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
  }
];

async function createBucket(bucket) {
  try {
    console.log(`\n📦 Creating bucket: ${bucket.name}...`);
    
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`❌ Error listing buckets:`, listError);
      return false;
    }
    
    const exists = existingBuckets?.some(b => b.id === bucket.id);
    
    if (exists) {
      console.log(`✅ Bucket "${bucket.name}" already exists, skipping...`);
      return true;
    }
    
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes
    });
    
    if (error) {
      console.error(`❌ Error creating bucket "${bucket.name}":`, error.message);
      return false;
    }
    
    console.log(`✅ Successfully created bucket: ${bucket.name} (public: ${bucket.public})`);
    return true;
  } catch (error) {
    console.error(`❌ Unexpected error creating bucket "${bucket.name}":`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Creating Supabase storage buckets...\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const bucket of buckets) {
    const success = await createBucket(bucket);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created/Skipped: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log(`\n⚠️  Some buckets failed to create. You may need to create them manually in the Supabase Dashboard.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All buckets are ready!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Run the migration: src/migrations/107_enable_public_images_access.sql`);
    console.log(`   2. Run the migration: src/migrations/099_setup_images_bucket_policies.sql`);
    console.log(`   3. Run the migration: src/migrations/101_setup_licence_idcards_bucket_policies.sql`);
  }
}

main().catch(console.error);

