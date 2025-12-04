require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTriggerViaSQL() {
    try {
        console.log('🔧 Creating trigger via alternative method...\n');

        // Step 1: Test if we can execute SQL via a different approach
        console.log('1. Testing SQL execution...');

        // Try to create a simple test function first
        const testFunctionSQL = `
            CREATE OR REPLACE FUNCTION test_function()
            RETURNS TEXT
            LANGUAGE plpgsql
            AS $$
            BEGIN
                RETURN 'Test function works!';
            END;
            $$;
        `;

        // Since we can't use run_sql, let's try a different approach
        // We'll create a simple test to see if the trigger is working

        console.log('\n2. Testing if trigger exists by checking behavior...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Trigger Test Job',
                description: 'Testing if trigger exists',
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

        // Get notification count before
        const { data: beforeNotifs, error: beforeError } = await supabase
            .from('notifications')
            .select('*');

        if (beforeError) {
            console.error('Error getting notifications before:', beforeError);
            return;
        } else {
            console.log(`Notifications before update: ${beforeNotifs?.length || 0}`);
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
            console.error('Error updating job:', updateError);
            return;
        } else {
            console.log('✅ Job updated successfully');
        }

        // Wait for trigger
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get notifications after
        const { data: afterNotifs, error: afterError } = await supabase
            .from('notifications')
            .select('*');

        if (afterError) {
            console.error('Error getting notifications after:', afterError);
            return;
        } else {
            console.log(`Notifications after update: ${afterNotifs?.length || 0}`);
        }

        const difference = (afterNotifs?.length || 0) - (beforeNotifs?.length || 0);
        console.log(`Difference: ${difference}`);

        if (difference > 0) {
            console.log('🎉 SUCCESS: Trigger is working!');

            // Show the new notification
            const newNotifs = afterNotifs?.slice(0, difference);
            console.log('New notifications:', newNotifs);
        } else {
            console.log('❌ FAILURE: Trigger is not working');
            console.log('\nThe trigger function was not created successfully.');
            console.log('Please run the following SQL in your Supabase SQL Editor:');
            console.log('\n' + '='.repeat(60));
            console.log(`
-- Copy and paste this into Supabase SQL Editor:

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();

-- Create the trigger function
CREATE OR REPLACE FUNCTION notify_admin_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Create notification
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data,
        created_at
    ) VALUES (
        NEW.admin_id,
        'Job Status Changed',
        format('Job "%s" status changed from %s to %s', 
            NEW.title, OLD.status, NEW.status),
        'job_status',
        jsonb_build_object(
            'jobId', NEW.id,
            'oldStatus', OLD.status,
            'newStatus', NEW.status
        ),
        NOW()
    );

    RAISE NOTICE 'Notification created for job %: % -> %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER job_status_notification_trigger
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_job_status_change();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;

-- Test the trigger
DO $$
DECLARE
    test_job_id UUID;
    notification_count_before INTEGER;
    notification_count_after INTEGER;
BEGIN
    -- Create a test job
    INSERT INTO jobs (
        title, description, location, rate, status, admin_id, created_at, updated_at
    ) VALUES (
        'SQL Test Job', 'Testing from SQL', 'Test Location', '25', 'open',
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa', NOW(), NOW()
    ) RETURNING id INTO test_job_id;
    
    -- Count notifications before
    SELECT COUNT(*) INTO notification_count_before FROM notifications;
    
    RAISE NOTICE 'Test job ID: %, Notifications before: %', test_job_id, notification_count_before;
    
    -- Update job status to trigger notification
    UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = test_job_id;
    
    -- Wait a moment
    PERFORM pg_sleep(1);
    
    -- Count notifications after
    SELECT COUNT(*) INTO notification_count_after FROM notifications;
    
    RAISE NOTICE 'Notifications after: %, Difference: %', notification_count_after, notification_count_after - notification_count_before;
    
    -- Clean up
    DELETE FROM jobs WHERE id = test_job_id;
    
    RAISE NOTICE 'Test completed. Trigger is %', 
        CASE 
            WHEN notification_count_after > notification_count_before THEN 'WORKING'
            ELSE 'NOT WORKING'
        END;
END $$;
            `);
            console.log('='.repeat(60));
        }

        // Clean up test job
        await supabase
            .from('jobs')
            .delete()
            .eq('id', testJob.id);
        console.log('Test job cleaned up');

    } catch (error) {
        console.error('Trigger creation failed:', error);
        process.exit(1);
    }
}

createTriggerViaSQL(); 