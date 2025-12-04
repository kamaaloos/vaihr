require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runNotificationMigration() {
    try {
        console.log('🚀 Running notification migration...\n');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../simple_notification_migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Migration SQL loaded, executing...');

        // Execute the migration using RPC with correct function name
        const { error } = await supabase.rpc('run_sql', { query: migrationSQL });

        if (error) {
            console.error('Migration failed:', error);

            // Try alternative approach using direct SQL execution
            console.log('Trying alternative approach...');

            // Split the SQL into individual statements and execute them
            const statements = migrationSQL.split(';').filter((stmt: string) => stmt.trim());

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i].trim();
                if (statement) {
                    try {
                        console.log(`Executing statement ${i + 1}/${statements.length}...`);
                        const { error: stmtError } = await supabase.rpc('run_sql', { query: statement + ';' });
                        if (stmtError) {
                            console.error(`Statement ${i + 1} failed:`, stmtError);
                        }
                    } catch (err) {
                        console.error(`Statement ${i + 1} error:`, err);
                    }
                }
            }
        } else {
            console.log('✅ Migration completed successfully!');
        }

        // Test the trigger
        console.log('\n🧪 Testing the notification trigger...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Test Job for Migration',
                description: 'Testing notification trigger after migration',
                location: 'Test Location',
                rate: '25',
                status: 'open',
                admin_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (jobError) {
            console.error('Error creating test job:', jobError);
        } else {
            console.log('✅ Test job created:', testJob.id);

            // Get notification count before
            const { data: beforeCount, error: beforeError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true });

            if (beforeError) {
                console.error('Error getting count before:', beforeError);
            } else {
                console.log('Notifications before update:', beforeCount);

                // Update job status to trigger notification
                const { error: updateError } = await supabase
                    .from('jobs')
                    .update({
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', testJob.id);

                if (updateError) {
                    console.error('Error updating job:', updateError);
                } else {
                    console.log('Job updated successfully');

                    // Wait for trigger
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Check notifications after
                    const { data: afterCount, error: afterError } = await supabase
                        .from('notifications')
                        .select('*', { count: 'exact', head: true });

                    if (afterError) {
                        console.error('Error getting count after:', afterError);
                    } else {
                        console.log('Notifications after update:', afterCount);

                        if (afterCount > beforeCount) {
                            console.log('🎉 SUCCESS: Notification was created by trigger!');

                            // Show the new notification
                            const { data: newNotif, error: newError } = await supabase
                                .from('notifications')
                                .select('*')
                                .gte('created_at', new Date(Date.now() - 10000).toISOString())
                                .order('created_at', { ascending: false })
                                .limit(1);

                            if (newError) {
                                console.error('Error fetching new notification:', newError);
                            } else {
                                console.log('New notification:', newNotif);
                            }
                        } else {
                            console.log('❌ FAILURE: No notification was created by trigger');
                            console.log('The migration may not have worked properly');
                        }
                    }
                }
            }

            // Clean up test job
            await supabase
                .from('jobs')
                .delete()
                .eq('id', testJob.id);
            console.log('Test job cleaned up');
        }

        console.log('\n🔍 Migration and test complete!');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runNotificationMigration(); 