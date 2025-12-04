require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSimpleTrigger() {
    try {
        console.log('🔧 Creating simple notification trigger...\n');

        // Step 1: Create a simple trigger function
        console.log('1. Creating simple trigger function...');
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

                -- Create a simple notification
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
        } else {
            console.log('✅ Function created successfully');
        }

        // Step 2: Create the trigger
        console.log('\n2. Creating trigger...');
        const createTriggerSQL = `
            DROP TRIGGER IF EXISTS job_status_notification_trigger ON jobs;
            CREATE TRIGGER job_status_notification_trigger
                AFTER UPDATE ON jobs
                FOR EACH ROW
                EXECUTE FUNCTION notify_admin_on_job_status_change();
        `;

        const { error: triggerError } = await supabase.rpc('run_sql', { query: createTriggerSQL });
        if (triggerError) {
            console.error('Error creating trigger:', triggerError);
        } else {
            console.log('✅ Trigger created successfully');
        }

        // Step 3: Grant permissions
        console.log('\n3. Granting permissions...');
        const grantSQL = `
            GRANT EXECUTE ON FUNCTION notify_admin_on_job_status_change() TO authenticated;
        `;

        const { error: grantError } = await supabase.rpc('run_sql', { query: grantSQL });
        if (grantError) {
            console.error('Error granting permissions:', grantError);
        } else {
            console.log('✅ Permissions granted');
        }

        // Step 4: Test the trigger
        console.log('\n4. Testing the trigger...');

        // Create a test job
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Simple Trigger Test',
                description: 'Testing simple notification trigger',
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
                            console.log('🎉 SUCCESS: Notification was created by trigger!');

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
                            console.log('Let\'s check if the trigger exists...');

                            // Check if trigger exists
                            const { data: triggers, error: triggerCheckError } = await supabase
                                .from('information_schema.triggers')
                                .select('trigger_name, event_manipulation')
                                .eq('trigger_name', 'job_status_notification_trigger');

                            if (triggerCheckError) {
                                console.error('Error checking triggers:', triggerCheckError);
                            } else {
                                console.log('Triggers found:', triggers);
                            }
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

        console.log('\n🔧 Simple trigger creation complete!');

    } catch (error) {
        console.error('Trigger creation failed:', error);
        process.exit(1);
    }
}

// Run the trigger creation
createSimpleTrigger(); 