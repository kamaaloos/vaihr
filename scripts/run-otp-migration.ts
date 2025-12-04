const { supabaseMigration } = require('../src/config/supabase');
const fs = require('fs');
const path = require('path');

async function runOTPMigration() {
    try {
        console.log('🚀 Starting OTP migration...');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../src/migrations/091_create_otp_codes_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Migration SQL loaded');

        // Execute the migration
        const { data, error } = await supabaseMigration.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }

        console.log('✅ OTP migration completed successfully!');
        console.log('📊 Migration result:', data);

        // Test the table creation
        const { data: testData, error: testError } = await supabaseMigration
            .from('otp_codes')
            .select('count', { count: 'exact', head: true });

        if (testError) {
            console.error('❌ Table test failed:', testError);
        } else {
            console.log('✅ OTP codes table created and accessible');
        }

    } catch (error) {
        console.error('💥 Migration error:', error);
        process.exit(1);
    }
}

// Run the migration
runOTPMigration();
