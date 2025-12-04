require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deepDebug() {
    try {
        console.log('🔍 Deep debugging trigger issue...\n');

        // Check current schema
        console.log('1. Checking current schema...');
        const { data: currentSchema, error: schemaError } = await supabase.rpc('run_sql', {
            query: `SELECT current_schema()`
        });
        console.log('Current schema:', currentSchema);

        // Check all functions in all schemas
        console.log('\n2. Checking all functions...');
        const { data: allFunctions, error: funcError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    n.nspname as schema_name,
                    p.proname as function_name,
                    p.prosrc as function_source
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname LIKE '%notify%' OR p.proname LIKE '%job%'
                ORDER BY n.nspname, p.proname
            `
        });
        console.log('All relevant functions:', allFunctions);

        // Check all triggers in all schemas
        console.log('\n3. Checking all triggers...');
        const { data: allTriggers, error: triggerError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    n.nspname as schema_name,
                    t.tgname as trigger_name,
                    c.relname as table_name,
                    t.tgtype,
                    t.tgenabled
                FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE t.tgname LIKE '%job%' OR t.tgname LIKE '%notify%'
                ORDER BY n.nspname, t.tgname
            `
        });
        console.log('All relevant triggers:', allTriggers);

        // Check if the jobs table exists and its structure
        console.log('\n4. Checking jobs table...');
        const { data: jobsTable, error: jobsError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'jobs'
                ORDER BY ordinal_position
            `
        });
        console.log('Jobs table structure:', jobsTable);

        // Check if the notifications table exists and its structure
        console.log('\n5. Checking notifications table...');
        const { data: notifTable, error: notifError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'notifications'
                ORDER BY ordinal_position
            `
        });
        console.log('Notifications table structure:', notifTable);

        // Check RLS policies
        console.log('\n6. Checking RLS policies...');
        const { data: rlsPolicies, error: rlsError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    schemaname,
                    tablename,
                    policyname,
                    permissive,
                    roles,
                    cmd,
                    qual,
                    with_check
                FROM pg_policies 
                WHERE tablename IN ('jobs', 'notifications')
            `
        });
        console.log('RLS policies:', rlsPolicies);

        // Check if we can insert into notifications manually
        console.log('\n7. Testing manual notification insert...');
        const { data: manualInsert, error: manualError } = await supabase.rpc('run_sql', {
            query: `
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    data,
                    created_at
                ) VALUES (
                    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa',
                    'Manual Test',
                    'Testing manual insert',
                    'test',
                    '{"test": true}'::jsonb,
                    NOW()
                ) RETURNING id, title, created_at;
            `
        });
        console.log('Manual insert result:', manualInsert);

        if (manualError) {
            console.error('Manual insert error:', manualError);
        } else {
            // Clean up the test notification
            await supabase.rpc('run_sql', {
                query: `DELETE FROM notifications WHERE title = 'Manual Test'`
            });
        }

        // Check if the function exists in the public schema specifically
        console.log('\n8. Checking function in public schema...');
        const { data: publicFunc, error: publicFuncError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    proname as function_name,
                    prosrc as function_source
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' 
                AND p.proname = 'notify_admin_on_job_status_change'
            `
        });
        console.log('Function in public schema:', publicFunc);

        // Check if the trigger exists in the public schema specifically
        console.log('\n9. Checking trigger in public schema...');
        const { data: publicTrigger, error: publicTriggerError } = await supabase.rpc('run_sql', {
            query: `
                SELECT 
                    t.tgname as trigger_name,
                    c.relname as table_name,
                    t.tgtype,
                    t.tgenabled
                FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE n.nspname = 'public' 
                AND t.tgname = 'job_status_notification_trigger'
            `
        });
        console.log('Trigger in public schema:', publicTrigger);

        // Test a simple job update to see if we get any errors
        console.log('\n10. Testing job update with error capture...');
        const { data: testJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
                title: 'Deep Debug Test',
                description: 'Testing deep debug',
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

            // Try to update and capture any errors
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
            }

            // Clean up
            await supabase
                .from('jobs')
                .delete()
                .eq('id', testJob.id);
            console.log('Test job cleaned up');
        }

    } catch (error) {
        console.error('Deep debug failed:', error);
        process.exit(1);
    }
}

deepDebug(); 