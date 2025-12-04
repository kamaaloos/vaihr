require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugTriggerIssues() {
    try {
        console.log('🔍 Debugging trigger issues...\n');

        // Check if we can insert notifications manually with the same user_id
        console.log('1. Testing manual notification insert with admin user...');
        const { data: manualNotif, error: manualError } = await supabase
            .from('notifications')
            .insert({
                user_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                title: 'Manual Test',
                message: 'Testing manual insert',
                type: 'test',
                data: { test: true },
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (manualError) {
            console.error('❌ Manual insert failed:', manualError);
            console.log('This suggests RLS policies are blocking inserts');
        } else {
            console.log('✅ Manual insert successful:', manualNotif);

            // Clean up
            await supabase
                .from('notifications')
                .delete()
                .eq('id', manualNotif.id);
            console.log('Manual test notification cleaned up');
        }

        // Check if the admin user exists and has the right permissions
        console.log('\n2. Checking admin user...');
        const { data: adminUser, error: userError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('id', 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa')
            .single();

        if (userError) {
            console.error('❌ Error fetching admin user:', userError);
        } else {
            console.log('✅ Admin user found:', adminUser);
        }

        // Check notifications table structure
        console.log('\n3. Checking notifications table...');
        const { data: notifCount, error: countError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error counting notifications:', countError);
        } else {
            console.log(`✅ Notifications table accessible. Current count: ${notifCount}`);
        }

        // Test with a different approach - try to create a notification with different data
        console.log('\n4. Testing notification with job-like data...');
        const { data: jobNotif, error: jobNotifError } = await supabase
            .from('notifications')
            .insert({
                user_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                title: 'Job Status Changed',
                message: 'Job "Test Job" status changed from open to completed',
                type: 'job_status',
                data: {
                    jobId: 'test-job-id',
                    oldStatus: 'open',
                    newStatus: 'completed'
                },
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (jobNotifError) {
            console.error('❌ Job notification insert failed:', jobNotifError);
        } else {
            console.log('✅ Job notification insert successful:', jobNotif);

            // Clean up
            await supabase
                .from('notifications')
                .delete()
                .eq('id', jobNotif.id);
            console.log('Job test notification cleaned up');
        }

        // Check if there are any existing notifications
        console.log('\n5. Checking existing notifications...');
        const { data: existingNotifs, error: existingError } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (existingError) {
            console.error('❌ Error fetching existing notifications:', existingError);
        } else {
            console.log(`✅ Existing notifications: ${existingNotifs?.length || 0}`);
            if (existingNotifs && existingNotifs.length > 0) {
                console.log('Latest notification:', existingNotifs[0]);
            }
        }

        // Test job creation and update with detailed logging
        console.log('\n6. Testing job creation and update with detailed logging...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Debug Test Job',
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
            console.error('❌ Error creating test job:', jobError);
            return;
        } else {
            console.log('✅ Test job created:', testJob);
        }

        // Get notification count before
        const { data: beforeNotifs, error: beforeError } = await supabase
            .from('notifications')
            .select('*');

        if (beforeError) {
            console.error('❌ Error getting notifications before:', beforeError);
            return;
        } else {
            console.log(`📊 Notifications before update: ${beforeNotifs?.length || 0}`);
        }

        // Update job status
        const { error: updateError } = await supabase
            .from('jobs')
            .update({
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', testJob.id);

        if (updateError) {
            console.error('❌ Error updating job:', updateError);
            return;
        } else {
            console.log('✅ Job updated successfully');
        }

        // Wait for trigger
        console.log('⏳ Waiting for trigger to execute...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get notifications after
        const { data: afterNotifs, error: afterError } = await supabase
            .from('notifications')
            .select('*');

        if (afterError) {
            console.error('❌ Error getting notifications after:', afterError);
            return;
        } else {
            console.log(`📊 Notifications after update: ${afterNotifs?.length || 0}`);
        }

        const difference = (afterNotifs?.length || 0) - (beforeNotifs?.length || 0);
        console.log(`📊 Difference: ${difference}`);

        if (difference > 0) {
            console.log('🎉 SUCCESS: Trigger is working!');

            // Show the new notification
            const newNotifs = afterNotifs?.slice(0, difference);
            console.log('New notifications:', newNotifs);
        } else {
            console.log('❌ FAILURE: Trigger is still not working');
            console.log('\n🔍 Possible issues:');
            console.log('1. The SQL migration did not execute successfully');
            console.log('2. The trigger function has a syntax error');
            console.log('3. RLS policies are blocking the trigger from inserting');
            console.log('4. The trigger is disabled or not properly attached');
            console.log('5. There might be a schema issue');

            console.log('\n💡 Next steps:');
            console.log('1. Check the Supabase SQL Editor logs for any errors');
            console.log('2. Verify the trigger was created by running:');
            console.log('   SELECT * FROM information_schema.triggers WHERE trigger_name = \'job_status_notification_trigger\';');
            console.log('3. Check if the function exists by running:');
            console.log('   SELECT * FROM information_schema.routines WHERE routine_name = \'notify_admin_on_job_status_change\';');
        }

        // Clean up test job
        await supabase
            .from('jobs')
            .delete()
            .eq('id', testJob.id);
        console.log('✅ Test job cleaned up');

        console.log('\n🔍 Debugging complete!');

    } catch (error) {
        console.error('Debugging failed:', error);
        process.exit(1);
    }
}

debugTriggerIssues(); 