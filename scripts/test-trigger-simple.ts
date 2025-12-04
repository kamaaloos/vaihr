const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('  - EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('  - EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTrigger() {
    console.log('🧪 Testing trigger with service role...\n');

    try {
        // 1. Check current notifications
        console.log('1. Checking current notifications...');
        const { data: notificationsBefore, error: notificationsError } = await supabase
            .from('notifications')
            .select('id')
            .limit(1);

        if (notificationsError) {
            console.log('❌ Error checking notifications:', notificationsError);
            return;
        }

        console.log(`Current notifications: ${notificationsBefore?.length || 0}`);

        // 2. Create a test job
        console.log('\n2. Creating test job...');
        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Service Role Test Job',
                description: 'Testing trigger with service role',
                location: 'Test Location',
                rate: '25',
                status: 'open',
                admin_id: 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'
            })
            .select()
            .single();

        if (jobError) {
            console.log('❌ Error creating job:', jobError);
            return;
        }

        console.log(`✅ Test job created: ${job.id}`);
        console.log(`Notifications before update: ${notificationsBefore?.length || 0}`);

        // 3. Update job status to trigger notification
        console.log('\n3. Updating job status...');
        const { error: updateError } = await supabase
            .from('jobs')
            .update({
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

        if (updateError) {
            console.log('❌ Error updating job:', updateError);
            return;
        }

        console.log('✅ Job updated successfully');

        // 4. Wait for trigger to execute
        console.log('\n4. Waiting for trigger to execute...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 5. Check notifications after update
        console.log('\n5. Checking notifications after update...');
        const { data: notificationsAfter, error: notificationsAfterError } = await supabase
            .from('notifications')
            .select('*')
            .gte('created_at', new Date(Date.now() - 10000).toISOString());

        if (notificationsAfterError) {
            console.log('❌ Error checking notifications after:', notificationsAfterError);
            return;
        }

        console.log(`Notifications after update: ${notificationsAfter?.length || 0}`);

        // 6. Display results
        console.log('\n📊 Results:');
        console.log(`- Notifications before: ${notificationsBefore?.length || 0}`);
        console.log(`- Notifications after: ${notificationsAfter?.length || 0}`);
        console.log(`- Difference: ${(notificationsAfter?.length || 0) - (notificationsBefore?.length || 0)}`);

        if (notificationsAfter && notificationsAfter.length > 0) {
            console.log('\n✅ SUCCESS: Trigger is working!');
            console.log('\nNew notifications:');
            notificationsAfter.forEach((notification: any, index: number) => {
                console.log(`  ${index + 1}. ${notification.title}: ${notification.message}`);
                console.log(`     Type: ${notification.type}, Data: ${JSON.stringify(notification.data)}`);
            });
        } else {
            console.log('\n❌ FAILURE: Trigger is not working');
            console.log('\n🔍 Debugging information:');

            // Check if trigger function exists
            const { data: functionCheck, error: functionError } = await supabase
                .rpc('run_sql', {
                    sql: "SELECT proname FROM pg_proc WHERE proname = 'notify_admin_on_job_status_change'"
                });

            if (functionError) {
                console.log('  - Cannot check trigger function (RPC error):', functionError.message);
            } else {
                console.log(`  - Trigger function exists: ${functionCheck?.length > 0}`);
            }

            // Check if trigger exists
            const { data: triggerCheck, error: triggerError } = await supabase
                .rpc('run_sql', {
                    sql: "SELECT tgname FROM pg_trigger WHERE tgname = 'job_status_notification_trigger'"
                });

            if (triggerError) {
                console.log('  - Cannot check trigger (RPC error):', triggerError.message);
            } else {
                console.log(`  - Trigger exists: ${triggerCheck?.length > 0}`);
            }
        }

        // 7. Clean up test job
        console.log('\n7. Cleaning up test job...');
        const { error: cleanupError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', job.id);

        if (cleanupError) {
            console.log('❌ Error cleaning up job:', cleanupError);
        } else {
            console.log('✅ Test job cleaned up');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }

    console.log('\n🧪 Service role trigger test completed!');
}

testTrigger(); 