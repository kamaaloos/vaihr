const { createClient } = require('@supabase/supabase-js');
const { resolve } = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugNotifications() {
    try {
        console.log('🔍 Debugging Notification System...\n');

        // 1. Check if triggers exist
        console.log('1. Checking notification triggers...');
        const { data: triggers, error: triggersError } = await supabase
            .from('information_schema.triggers')
            .select('trigger_name, event_manipulation, action_timing')
            .like('trigger_name', '%notification%');

        if (triggersError) {
            console.error('Error checking triggers:', triggersError);
        } else {
            console.log('Found triggers:', triggers);
        }

        // 2. Check if functions exist
        console.log('\n2. Checking notification functions...');
        const { data: functions, error: functionsError } = await supabase
            .from('information_schema.routines')
            .select('routine_name, routine_type')
            .like('routine_name', '%notification%');

        if (functionsError) {
            console.error('Error checking functions:', functionsError);
        } else {
            console.log('Found functions:', functions);
        }

        // 3. Check notifications table structure
        console.log('\n3. Checking notifications table structure...');
        const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', 'notifications')
            .order('ordinal_position');

        if (columnsError) {
            console.error('Error checking notifications table:', columnsError);
        } else {
            console.log('Notifications table columns:', columns);
        }

        // 4. Check notification counts
        console.log('\n4. Checking notification counts...');
        const { data: totalNotifications, error: totalError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true });

        if (totalError) {
            console.error('Error counting notifications:', totalError);
        } else {
            console.log('Total notifications:', totalNotifications);
        }

        // 5. Check job status notifications specifically
        const { data: jobStatusNotifications, error: jobStatusError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'job_status');

        if (jobStatusError) {
            console.error('Error counting job status notifications:', jobStatusError);
        } else {
            console.log('Job status notifications:', jobStatusNotifications);
        }

        // 6. Check admin users and their push tokens
        console.log('\n5. Checking admin users...');
        const { data: admins, error: adminsError } = await supabase
            .from('users')
            .select('id, name, email, expo_push_token, role')
            .eq('role', 'admin');

        if (adminsError) {
            console.error('Error fetching admins:', adminsError);
        } else {
            console.log('Admin users:', admins);

            // Fetch online status for admins separately
            if (admins && admins.length > 0) {
                const adminIds = admins.map(admin => admin.id);
                const { data: adminStatus, error: statusError } = await supabase
                    .from('user_status')
                    .select('user_id, is_online')
                    .in('user_id', adminIds);

                if (statusError) {
                    console.error('Error fetching admin status:', statusError);
                } else {
                    console.log('Admin online status:', adminStatus);
                }
            }
        }

        // 7. Check recent job status changes
        console.log('\n6. Checking recent job status changes...');
        const { data: recentJobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title, status, admin_id, driver_id, created_at, updated_at')
            .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('updated_at', { ascending: false })
            .limit(10);

        if (jobsError) {
            console.error('Error fetching recent jobs:', jobsError);
        } else {
            console.log('Recent job updates:', recentJobs);
        }

        // 8. Check recent notifications
        console.log('\n7. Checking recent notifications...');
        const { data: recentNotifications, error: recentError } = await supabase
            .from('notifications')
            .select('id, user_id, title, message, type, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentError) {
            console.error('Error fetching recent notifications:', recentError);
        } else {
            console.log('Recent notifications:', recentNotifications);
        }

        // 9. Test the trigger manually
        console.log('\n8. Testing notification trigger...');

        // Get a job that's not completed and has an admin
        const { data: testJob, error: testJobError } = await supabase
            .from('jobs')
            .select('id, admin_id, status')
            .neq('status', 'completed')
            .not('admin_id', 'is', null)
            .limit(1);

        if (testJobError) {
            console.error('Error finding test job:', testJobError);
        } else if (testJob && testJob.length > 0) {
            const job = testJob[0];
            console.log('Testing with job:', job);

            // Get notification count before
            const { data: beforeCount, error: beforeError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true });

            if (beforeError) {
                console.error('Error getting notification count before:', beforeError);
            } else {
                console.log('Notifications before test:', beforeCount);

                // Update the job status
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

                    // Wait a moment for trigger to execute
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Get notification count after
                    const { data: afterCount, error: afterError } = await supabase
                        .from('notifications')
                        .select('*', { count: 'exact', head: true });

                    if (afterError) {
                        console.error('Error getting notification count after:', afterError);
                    } else {
                        console.log('Notifications after test:', afterCount);

                        if (afterCount > beforeCount) {
                            console.log('✅ SUCCESS: Notification was created!');

                            // Show the created notification
                            const { data: newNotification, error: newError } = await supabase
                                .from('notifications')
                                .select('*')
                                .gte('created_at', new Date(Date.now() - 5000).toISOString())
                                .order('created_at', { ascending: false })
                                .limit(1);

                            if (newError) {
                                console.error('Error fetching new notification:', newError);
                            } else {
                                console.log('New notification:', newNotification);
                            }
                        } else {
                            console.log('❌ FAILURE: No notification was created');
                        }
                    }
                }
            }
        } else {
            console.log('No suitable jobs found for testing');
        }

        console.log('\n🔍 Debug complete!');

    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

// Run the debug
debugNotifications(); 