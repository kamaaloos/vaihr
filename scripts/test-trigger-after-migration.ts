require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTriggerAfterMigration() {
    try {
        console.log('🧪 Testing trigger after migration...\n');

        // Check current notifications
        console.log('1. Checking current notifications...');
        const { data: currentNotifs, error: notifError } = await supabase
            .from('notifications')
            .select('*');

        if (notifError) {
            console.error('Error fetching notifications:', notifError);
        } else {
            console.log(`Current notifications: ${currentNotifs?.length || 0}`);
        }

        // Create a test job
        console.log('\n2. Creating test job...');
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Post-Migration Test',
                description: 'Testing trigger after migration',
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
            return;
        } else {
            console.log('✅ Test job created:', testJob.id);
        }

        // Get notification count before update
        const { data: beforeNotifs, error: beforeError } = await supabase
            .from('notifications')
            .select('*');

        if (beforeError) {
            console.error('Error getting notifications before:', beforeError);
            return;
        } else {
            console.log(`Notifications before update: ${beforeNotifs?.length || 0}`);
        }

        // Update job status to trigger notification
        console.log('\n3. Updating job status...');
        const { error: updateError } = await supabase
            .from('jobs')
            .update({
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', testJob.id);

        if (updateError) {
            console.error('Error updating job:', updateError);
            return;
        } else {
            console.log('✅ Job updated successfully');
        }

        // Wait for trigger to execute
        console.log('\n4. Waiting for trigger to execute...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check notifications after update
        console.log('\n5. Checking notifications after update...');
        const { data: afterNotifs, error: afterError } = await supabase
            .from('notifications')
            .select('*');

        if (afterError) {
            console.error('Error getting notifications after:', afterError);
            return;
        } else {
            console.log(`Notifications after update: ${afterNotifs?.length || 0}`);
        }

        // Calculate difference
        const difference = (afterNotifs?.length || 0) - (beforeNotifs?.length || 0);
        console.log(`\n📊 Results:`);
        console.log(`- Notifications before: ${beforeNotifs?.length || 0}`);
        console.log(`- Notifications after: ${afterNotifs?.length || 0}`);
        console.log(`- Difference: ${difference}`);

        if (difference > 0) {
            console.log('\n🎉 SUCCESS: Trigger is working!');

            // Show the new notification
            const newNotifs = afterNotifs?.slice(0, difference);
            console.log('\nNew notification(s):');
            newNotifs?.forEach((notif, index) => {
                console.log(`${index + 1}. ${notif.title}: ${notif.message}`);
                console.log(`   Type: ${notif.type}, Data:`, notif.data);
            });
        } else {
            console.log('\n❌ FAILURE: Trigger is not working');
            console.log('\nPossible issues:');
            console.log('1. The migration SQL was not run in Supabase dashboard');
            console.log('2. The trigger function has an error');
            console.log('3. RLS policies are blocking the insert');
            console.log('4. The admin_id does not exist in the users table');
        }

        // Clean up test job
        console.log('\n6. Cleaning up test job...');
        const { error: cleanupError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', testJob.id);

        if (cleanupError) {
            console.error('Error cleaning up test job:', cleanupError);
        } else {
            console.log('✅ Test job cleaned up');
        }

        console.log('\n🧪 Test completed!');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testTriggerAfterMigration(); 