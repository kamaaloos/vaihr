require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simpleTriggerTest() {
    try {
        console.log('🧪 Simple trigger test...\n');

        // Step 1: Check current state
        console.log('1. Checking current notifications...');
        const { data: currentNotifs, error: notifError } = await supabase
            .from('notifications')
            .select('*');

        if (notifError) {
            console.error('Error fetching notifications:', notifError);
            return;
        } else {
            console.log(`Current notifications: ${currentNotifs?.length || 0}`);
        }

        // Step 2: Create a test job
        console.log('\n2. Creating test job...');
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Simple Trigger Test',
                description: 'Testing simple trigger',
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

        // Step 3: Get notification count before update
        const { data: beforeNotifs, error: beforeError } = await supabase
            .from('notifications')
            .select('*');

        if (beforeError) {
            console.error('Error getting notifications before:', beforeError);
            return;
        } else {
            console.log(`Notifications before update: ${beforeNotifs?.length || 0}`);
        }

        // Step 4: Update job status
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

        // Step 5: Wait for trigger
        console.log('\n4. Waiting for trigger to execute...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 6: Check notifications after
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

        // Step 7: Calculate results
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
            console.log('\n🔍 Next steps:');
            console.log('1. Run the SQL in supabase/check-trigger-status.sql in your Supabase SQL Editor');
            console.log('2. Check if the trigger function was created successfully');
            console.log('3. Look for any error messages in the SQL Editor output');
        }

        // Step 8: Clean up
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

        console.log('\n🧪 Simple trigger test completed!');

    } catch (error) {
        console.error('Simple trigger test failed:', error);
        process.exit(1);
    }
}

simpleTriggerTest(); 