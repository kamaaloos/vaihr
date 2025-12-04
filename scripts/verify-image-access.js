/**
 * Script to verify image access in Supabase storage
 * 
 * Run this script with: node scripts/verify-image-access.js <image-filename>
 * Example: node scripts/verify-image-access.js fb46cc34-37ed-495f-8c3b-e7e7f1885e47-profile.jpg
 */

const { createClient } = require('@supabase/supabase-js');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, use environment variables directly
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyImageAccess(filename) {
  console.log(`\n🔍 Verifying image access for: ${filename}\n`);
  
  try {
    // Get public URL
    const { data: urlData, error: urlError } = supabase.storage
      .from('images')
      .getPublicUrl(filename);
    
    if (urlError) {
      console.error('❌ Error getting public URL:', urlError);
      return;
    }
    
    console.log('📝 Public URL:', urlData.publicUrl);
    
    // Try to fetch the image
    console.log('\n🌐 Testing image accessibility...');
    const response = await fetch(urlData.publicUrl);
    
    console.log('   Status:', response.status, response.statusText);
    console.log('   Content-Type:', response.headers.get('content-type'));
    console.log('   Content-Length:', response.headers.get('content-length'), 'bytes');
    
    if (response.ok) {
      console.log('\n✅ Image is accessible!');
      console.log('   The URL should work in your app.');
    } else {
      console.log('\n❌ Image is NOT accessible');
      console.log('   Possible issues:');
      console.log('   1. Bucket is not set to public in Supabase Dashboard');
      console.log('   2. RLS policy for public access is not applied');
      console.log('   3. File does not exist or has wrong permissions');
      
      if (response.status === 404) {
        console.log('\n   💡 Check:');
        console.log('   - Go to Supabase Dashboard → Storage → images bucket');
        console.log('   - Verify the file exists: ' + filename);
      } else if (response.status === 403) {
        console.log('\n   💡 Fix:');
        console.log('   1. Go to Supabase Dashboard → Storage → images bucket');
        console.log('   2. Click "Settings" (gear icon)');
        console.log('   3. Make sure "Public bucket" is checked');
        console.log('   4. Run migration: src/migrations/107_enable_public_images_access.sql');
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Get filename from command line argument
const filename = process.argv[2];

if (!filename) {
  console.error('❌ Error: Please provide an image filename');
  console.error('   Usage: node scripts/verify-image-access.js <filename>');
  console.error('   Example: node scripts/verify-image-access.js fb46cc34-37ed-495f-8c3b-e7e7f1885e47-profile.jpg');
  process.exit(1);
}

verifyImageAccess(filename).catch(console.error);

