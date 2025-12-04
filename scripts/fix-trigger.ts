require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTrigger() {
    try {
        console.log('🔧 Fixing notification trigger...\n');

        // Step 1: Drop existing function and trigger if they exist
        console.log('1. Cleaning up existing function and trigger...');
        const cleanupSQL = `
            DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
            DROP FUNCTION IF EXISTS notify_admin_on_job_status_change();
        `;

        const { error: cleanupError } = await supabase.rpc('run_sql', { query: cleanupSQL });
        if (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        } else {
            console.log('✅ Cleanup completed');
        }

        // Step 2: Create the trigger function
        console.log('\n2. Creating trigger function...');
        const createFunctionSQL = `
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
        `;

        const { error: funcError } = await supabase.rpc('run_sql', { query: createFunctionSQL });
        if (funcError) {
            console.error('Error creating function:', funcError);
            return;
        } else {
            console.log('✅ Function created successfully');
        }

        // Step 3: Create the trigger
        console.log('\n3. Creating trigger...');
        const createTriggerSQL = `
            CREATE TRIGGER job_status_notification_trigger
                AFTER UPDATE ON jobs
                FOR EACH ROW
                EXECUTE FUNCTION notify_admin_on_job_status_change();
        `;

        const { error: triggerError } = await supabase.rpc('run_sql', { query: createTriggerSQL });
        if (triggerError) {
            console.error('Error creating trigger:', triggerError);
            return;
        } else {
            console.log('✅ Trigger created successfully');
        }

        // Step 4: Grant permissions
        console.log('\n4. Granting permissions...');
        const grantSQL = `
            GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;
        `;

        const { error: grantError } = await supabase.rpc('run_sql', { query: grantSQL });
        if (grantError) {
            console.error('Error granting permissions:', grantError);
        } else {
            console.log('✅ Permissions granted');
        }

        // Step 5: Verify the function and trigger exist
        console.log('\n5. Verifying function and trigger...');

        // Check function
        const { data: funcCheck, error: funcCheckError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    proname as function_name,
                    prosrc as function_source
                FROM pg_proc 
                WHERE proname = 'notify_admin_on_job_status_change'
            `
        });

        if (funcCheckError) {
            console.error('Error checking function:', funcCheckError);
        } else {
            console.log('Function verification:', funcCheck);
        }

        // Check trigger
        const { data: triggerCheck, error: triggerCheckError } = await supabase.rpc('run_sql', {
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

        if (triggerCheckError) {
            console.error('Error checking trigger:', triggerCheckError);
        } else {
            console.log('Trigger verification:', triggerCheck);
        }

        // Step 6: Test the trigger
        console.log('\n6. Testing the trigger...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Fixed Trigger Test',
                description: 'Testing fixed notification trigger',
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
                    const { data: afterNotifs, error: afterError } = await supabase
                        .from('notifications')
                        .select('*');

                    if (afterError) {
                        console.error('Error getting notifications after:', afterError);
                    } else {
                        console.log(`Notifications after update: ${afterNotifs?.length || 0}`);

                        const difference = (afterNotifs?.length || 0) - (beforeNotifs?.length || 0);
                        console.log(`Difference: ${difference}`);

                        if (difference > 0) {
                            console.log('🎉 SUCCESS: Trigger is working!');

                            // Show the new notification
                            const newNotifs = afterNotifs?.slice(0, difference);
                            console.log('New notifications:', newNotifs);
                        } else {
                            console.log('❌ FAILURE: Trigger still not working');
                            console.log('Let\'s check the database logs...');
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

        console.log('\n🔧 Trigger fix complete!');

    } catch (error) {
        console.error('Trigger fix failed:', error);
        process.exit(1);
    }
}

fixTrigger(); 