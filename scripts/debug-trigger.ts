require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugTrigger() {
    try {
        console.log('🔍 Debugging trigger...\n');

        // Check if the function exists
        console.log('1. Checking if function exists...');
        const { data: functions, error: funcError } = await supabase.rpc('run_sql', {
            query: `
                SELECT routine_name, routine_type 
                FROM information_schema.routines 
                WHERE routine_name = 'notify_admin_on_job_status_change'
            `
        });

        if (funcError) {
            console.error('Error checking functions:', funcError);
        } else {
            console.log('Functions found:', functions);
        }

        // Check if the trigger exists using a different approach
        console.log('\n2. Checking if trigger exists...');
        const { data: triggers, error: triggerError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    trigger_name,
                    event_manipulation,
                    action_timing,
                    action_statement
                FROM information_schema.triggers 
                WHERE trigger_name = 'job_status_notification_trigger'
            `
        });

        if (triggerError) {
            console.error('Error checking triggers:', triggerError);
        } else {
            console.log('Triggers found:', triggers);
        }

        // Check current notifications
        console.log('\n3. Checking current notifications...');
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (notifError) {
            console.error('Error fetching notifications:', notifError);
        } else {
            console.log('Recent notifications:', notifications);
        }

        // Test with a simple job update
        console.log('\n4. Testing job update...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Debug Trigger Test',
                description: 'Testing trigger debugging',
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

            // Count notifications before
            const { count: beforeCount, error: beforeError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true });

            if (beforeError) {
                console.error('Error getting count before:', beforeError);
            } else {
                console.log('Notifications before update:', beforeCount);

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

                    // Wait a bit
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Count notifications after
                    const { count: afterCount, error: afterError } = await supabase
                        .from('notifications')
                        .select('*', { count: 'exact', head: true });

                    if (afterError) {
                        console.error('Error getting count after:', afterError);
                    } else {
                        console.log('Notifications after update:', afterCount);
                        console.log('Difference:', afterCount - beforeCount);

                        if (afterCount > beforeCount) {
                            console.log('🎉 SUCCESS: Trigger worked!');
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

        // Check if there are any recent notifications
        console.log('\n5. Checking for recent notifications...');
        const { data: recentNotifs, error: recentError } = await supabase
            .from('notifications')
            .select('*')
            .gte('created_at', new Date(Date.now() - 30000).toISOString())
            .order('created_at', { ascending: false });

        if (recentError) {
            console.error('Error fetching recent notifications:', recentError);
        } else {
            console.log('Recent notifications (last 30 seconds):', recentNotifs);
        }

    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugTrigger(); 