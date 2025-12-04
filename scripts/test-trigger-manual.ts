require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTriggerManual() {
    try {
        console.log('🔍 Manual trigger test...\n');

        // First, let's check the current state
        console.log('1. Checking current notifications...');
        const { data: allNotifs, error: notifError } = await supabase
            .from('notifications')
            .select('*');

        if (notifError) {
            console.error('Error fetching notifications:', notifError);
        } else {
            console.log(`Total notifications: ${allNotifs?.length || 0}`);
            if (allNotifs && allNotifs.length > 0) {
                console.log('Latest notification:', allNotifs[allNotifs.length - 1]);
            }
        }

        // Check if the function exists
        console.log('\n2. Checking function...');
        const { data: funcCheck, error: funcError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    proname as function_name,
                    prosrc as function_source
                FROM pg_proc 
                WHERE proname = 'notify_admin_on_job_status_change'
            `
        });

        if (funcError) {
            console.error('Error checking function:', funcError);
        } else {
            console.log('Function check result:', funcCheck);
        }

        // Check if the trigger exists
        console.log('\n3. Checking trigger...');
        const { data: triggerCheck, error: triggerError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    tgname as trigger_name,
                    tgrelid::regclass as table_name,
                    tgtype,
                    tgenabled
                FROM pg_trigger 
                WHERE tgname = 'job_status_notification_trigger'
            `
        });

        if (triggerError) {
            console.error('Error checking trigger:', triggerError);
        } else {
            console.log('Trigger check result:', triggerCheck);
        }

        // Test the function directly
        console.log('\n4. Testing function directly...');
        const { data: funcTest, error: funcTestError } = await supabase.rpc('run_sql', {
            query: `
                DO $$
                DECLARE
                    test_job jobs%ROWTYPE;
                    test_old jobs%ROWTYPE;
                BEGIN
                    -- Create a test job record
                    test_job.id := gen_random_uuid();
                    test_job.title := 'Test Job';
                    test_job.status := 'completed';
                    test_job.admin_id := 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';
                    test_job.created_at := NOW();
                    test_job.updated_at := NOW();
                    
                    -- Create old record
                    test_old.id := test_job.id;
                    test_old.title := test_job.title;
                    test_old.status := 'open';
                    test_old.admin_id := test_job.admin_id;
                    test_old.created_at := test_job.created_at;
                    test_old.updated_at := test_job.updated_at;
                    
                    -- Call the function manually
                    PERFORM notify_admin_on_job_status_change();
                    
                    RAISE NOTICE 'Function executed successfully';
                END $$;
            `
        });

        if (funcTestError) {
            console.error('Error testing function:', funcTestError);
        } else {
            console.log('Function test result:', funcTest);
        }

        // Check notifications after function test
        console.log('\n5. Checking notifications after function test...');
        const { data: afterNotifs, error: afterError } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (afterError) {
            console.error('Error fetching notifications after:', afterError);
        } else {
            console.log('Notifications after function test:', afterNotifs);
        }

        // Now let's test with a real job update
        console.log('\n6. Testing with real job update...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Manual Trigger Test',
                description: 'Testing manual trigger',
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
            const { data: beforeNotifs, error: beforeError } = await supabase
                .from('notifications')
                .select('*');

            if (beforeError) {
                console.error('Error getting notifications before:', beforeError);
            } else {
                console.log(`Notifications before update: ${beforeNotifs?.length || 0}`);

                // Update job status
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

                    // Get notifications after
                    const { data: afterUpdateNotifs, error: afterUpdateError } = await supabase
                        .from('notifications')
                        .select('*');

                    if (afterUpdateError) {
                        console.error('Error getting notifications after update:', afterUpdateError);
                    } else {
                        console.log(`Notifications after update: ${afterUpdateNotifs?.length || 0}`);

                        const difference = (afterUpdateNotifs?.length || 0) - (beforeNotifs?.length || 0);
                        console.log(`Difference: ${difference}`);

                        if (difference > 0) {
                            console.log('🎉 SUCCESS: Trigger worked!');

                            // Show the new notification
                            const newNotifs = afterUpdateNotifs?.slice(0, difference);
                            console.log('New notifications:', newNotifs);
                        } else {
                            console.log('❌ FAILURE: Trigger did not work');
                        }
                    }
                }
            }

            // Clean up
            await supabase
                .from('jobs')
                .delete()
                .eq('id', testJob.id);
            console.log('Test job cleaned up');
        }

    } catch (error) {
        console.error('Manual test failed:', error);
        process.exit(1);
    }
}

testTriggerManual(); 