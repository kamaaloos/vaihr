const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simpleDebug() {
    try {
        console.log('🔍 Simple Notification Debug...\n');

        // 1. Check if notifications table exists and has data
        console.log('1. Checking notifications table...');
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .limit(5);

        if (notifError) {
            console.error('Error accessing notifications table:', notifError);
        } else {
            console.log('Notifications found:', notifications?.length || 0);
            if (notifications && notifications.length > 0) {
                console.log('Sample notification:', notifications[0]);
            }
        }

        // 2. Check admin users
        console.log('\n2. Checking admin users...');
        const { data: admins, error: adminsError } = await supabase
            .from('users')
            .select('id, name, email, expo_push_token, role')
            .eq('role', 'admin');

        if (adminsError) {
            console.error('Error fetching admins:', adminsError);
        } else {
            console.log('Admin users:', admins);
        }

        // 3. Check recent jobs
        console.log('\n3. Checking recent jobs...');
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title, status, admin_id, driver_id, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (jobsError) {
            console.error('Error fetching jobs:', jobsError);
        } else {
            console.log('Recent jobs:', jobs);
        }

        // 4. Test creating a notification manually
        console.log('\n4. Testing manual notification creation...');
        if (admins && admins.length > 0) {
            const admin = admins[0];
            const { data: newNotif, error: createError } = await supabase
                .from('notifications')
                .insert({
                    user_id: admin.id,
                    title: 'Test Notification',
                    message: 'This is a test notification to verify the system works',
                    type: 'test',
                    data: { test: true },
                    push_token: admin.expo_push_token,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating test notification:', createError);
            } else {
                console.log('✅ Test notification created successfully:', newNotif);

                // Clean up test notification
                await supabase
                    .from('notifications')
                    .delete()
                    .eq('id', newNotif.id);
                console.log('Test notification cleaned up');
            }
        }

        // 5. Test job status update to trigger notification
        console.log('\n5. Testing job status update...');
        if (jobs && jobs.length > 0) {
            const job = jobs.find((j: any) => j.status !== 'completed');
            if (job) {
                console.log('Testing with job:', job);

                // Get notification count before
                const { data: beforeCount, error: beforeError } = await supabase
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
                        .eq('id', job.id);

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
                                console.log('This suggests the database trigger is not working');
                            }
                        }
                    }
                }
            } else {
                console.log('No non-completed jobs found for testing');
            }
        }

        console.log('\n🔍 Simple debug complete!');

    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

// Run the debug
simpleDebug(); 