require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
    try {
        console.log('🔍 Checking table structures...\n');

        // 1. Check notifications table structure
        console.log('1. Checking notifications table structure...');
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .limit(1);

        if (notifError) {
            console.error('Error accessing notifications table:', notifError);
        } else {
            console.log('Notifications table columns:', notifications && notifications.length > 0 ? Object.keys(notifications[0]) : 'No data to inspect');
        }

        // 2. Try to insert a notification with minimal fields
        console.log('\n2. Testing minimal notification insert...');
        const { data: testNotif, error: insertError } = await supabase
            .from('notifications')
            .insert({
                user_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                title: 'Test',
                message: 'Test message',
                type: 'test',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting minimal notification:', insertError);
        } else {
            console.log('✅ Minimal notification created:', testNotif);

            // Clean up
            await supabase
                .from('notifications')
                .delete()
                .eq('id', testNotif.id);
            console.log('Test notification cleaned up');
        }

        // 3. Check if there are any non-completed jobs
        console.log('\n3. Checking for non-completed jobs...');
        const { data: nonCompletedJobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title, status, admin_id')
            .neq('status', 'completed')
            .limit(5);

        if (jobsError) {
            console.error('Error fetching non-completed jobs:', jobsError);
        } else {
            console.log('Non-completed jobs:', nonCompletedJobs);
        }

        // 4. Create a test job for trigger testing
        console.log('\n4. Creating a test job for trigger testing...');
        const { data: testJob, error: jobInsertError } = await supabase
            .from('jobs')
            .insert({
                title: 'Test Job for Notifications',
                description: 'This is a test job to verify notification triggers',
                location: 'Test Location',
                rate: '25',
                status: 'open',
                admin_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (jobInsertError) {
            console.error('Error creating test job:', jobInsertError);
        } else {
            console.log('✅ Test job created:', testJob);

            // 5. Test the trigger by updating the job status
            console.log('\n5. Testing notification trigger...');

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
                            console.log('✅ SUCCESS: Notification was created by trigger!');

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
                            console.log('This confirms the database trigger is not working');
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

        console.log('\n🔍 Table structure check complete!');

    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

// Run the check
checkTableStructure(); 