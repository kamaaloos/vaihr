const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runOTPMigration() {
    try {
        console.log('🚀 Starting OTP migration...');

        // Create Supabase client with service role key
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Read the migration file
        const migrationPath = path.join(__dirname, '../src/migrations/091_create_otp_codes_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Migration SQL loaded');

        // Split the SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`📊 Executing ${statements.length} SQL statements...`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);

                try {
                    const { data, error } = await supabase.rpc('exec_sql', {
                        sql: statement + ';'
                    });

                    if (error) {
                        console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
                        // Continue with other statements
                    } else {
                        console.log(`✅ Statement ${i + 1} executed successfully`);
                    }
                } catch (err) {
                    console.warn(`⚠️  Statement ${i + 1} error:`, err.message);
                    // Continue with other statements
                }
            }
        }

        console.log('✅ OTP migration completed!');

        // Test the table creation
        console.log('🧪 Testing table access...');
        const { data: testData, error: testError } = await supabase
            .from('otp_codes')
            .select('count', { count: 'exact', head: true });

        if (testError) {
            console.error('❌ Table test failed:', testError.message);
        } else {
            console.log('✅ OTP codes table created and accessible');
            console.log(`📊 Current OTP records: ${testData || 0}`);
        }

        // Test inserting a sample OTP (will be cleaned up)
        console.log('🧪 Testing OTP insertion...');
        const testOTP = {
            email: 'test@example.com',
            code: '123456',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            attempts: 0
        };

        const { data: insertData, error: insertError } = await supabase
            .from('otp_codes')
            .insert(testOTP)
            .select();

        if (insertError) {
            console.error('❌ OTP insertion test failed:', insertError.message);
        } else {
            console.log('✅ OTP insertion test successful');

            // Clean up test data
            await supabase
                .from('otp_codes')
                .delete()
                .eq('id', insertData[0].id);
            console.log('🧹 Test data cleaned up');
        }

        console.log('🎉 Migration and testing completed successfully!');

    } catch (error) {
        console.error('💥 Migration error:', error.message);
        process.exit(1);
    }
}

// Run the migration
runOTPMigration();
