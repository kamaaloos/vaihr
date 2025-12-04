require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRPC() {
    try {
        console.log('🔍 Checking RPC functions...\n');

        // Test if run_sql exists
        console.log('1. Testing run_sql function...');
        try {
            const { data, error } = await supabase.rpc('run_sql', {
                query: 'SELECT 1 as test'
            });
            console.log('run_sql result:', { data, error });
        } catch (e) {
            console.log('run_sql error:', e);
        }

        // Test direct SQL query
        console.log('\n2. Testing direct SQL query...');
        try {
            const { data, error } = await supabase
                .from('jobs')
                .select('count(*)')
                .limit(1);
            console.log('Direct query result:', { data, error });
        } catch (e) {
            console.log('Direct query error:', e);
        }

        // Check what functions are available
        console.log('\n3. Checking available RPC functions...');
        try {
            const { data, error } = await supabase.rpc('run_sql', {
                query: `
                    SELECT 
                        p.proname as function_name,
                        n.nspname as schema_name
                    FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE n.nspname = 'public'
                    AND p.proname LIKE '%sql%'
                    ORDER BY p.proname
                `
            });
            console.log('Available SQL functions:', { data, error });
        } catch (e) {
            console.log('Error checking functions:', e);
        }

        // Try to create the trigger function using direct SQL
        console.log('\n4. Creating trigger function with direct SQL...');
        try {
            // First, let's create the function using a different approach
            const createFunctionSQL = `
                CREATE OR REPLACE FUNCTION public.notify_admin_on_job_status_change()
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
                    INSERT INTO public.notifications (
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

            // Try to execute this using the Supabase client directly
            const { data: funcResult, error: funcError } = await supabase
                .from('jobs')
                .select('id')
                .limit(1)
                .then(() => {
                    // If we can query jobs, let's try to create the function
                    return supabase.rpc('run_sql', { query: createFunctionSQL });
                });

            console.log('Function creation result:', { funcResult, funcError });
        } catch (e) {
            console.log('Error creating function:', e);
        }

        // Test if we can access the database directly
        console.log('\n5. Testing database access...');
        try {
            const { data: jobs, error: jobsError } = await supabase
                .from('jobs')
                .select('id, title, status')
                .limit(3);
            console.log('Jobs query result:', { jobs, jobsError });

            const { data: notifs, error: notifsError } = await supabase
                .from('notifications')
                .select('id, title, type')
                .limit(3);
            console.log('Notifications query result:', { notifs, notifsError });
        } catch (e) {
            console.log('Database access error:', e);
        }

    } catch (error) {
        console.error('RPC check failed:', error);
        process.exit(1);
    }
}

checkRPC(); 