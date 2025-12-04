import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
config({ path: resolve(__dirname, '../.env.migration') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('Running migration to fix raw_user_metadata column name...');

        // Read the migration SQL file
        const migrationPath = resolve(__dirname, '../src/migrations/079_fix_raw_user_metadata_column.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Migration SQL loaded, executing...');

        // Execute the migration
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

        if (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }

        console.log('Migration completed successfully!');

        // Verify the fix
        console.log('Verifying the fix...');
        const { data: columns, error: verifyError } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_schema', 'auth')
            .eq('table_name', 'users')
            .like('column_name', 'raw_user_meta%');

        if (verifyError) {
            console.error('Verification failed:', verifyError);
        } else {
            console.log('Available columns:', columns?.map(c => c.column_name));
        }

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration(); 