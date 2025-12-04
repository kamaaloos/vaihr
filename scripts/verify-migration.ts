require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
    try {
        console.log('🔍 Verifying migration results...\n');

        // Check if the function exists
        console.log('1. Checking if function exists...');
        const { data: functions, error: funcError } = await supabase
            .from('pg_proc')
            .select('proname, prosrc')
            .eq('proname', 'notify_admin_on_job_status_change');

        if (funcError) {
            console.error('Error checking functions:', funcError);
        } else {
            console.log('Functions found:', functions);
        }

        // Check if the trigger exists
        console.log('\n2. Checking if trigger exists...');
        const { data: triggers, error: triggerError } = await supabase
            .from('pg_trigger')
            .select('tgname, tgrelid, tgtype, tgenabled')
            .eq('tgname', 'job_status_notification_trigger');

        if (triggerError) {
            console.error('Error checking triggers:', triggerError);
        } else {
            console.log('Triggers found:', triggers);
        }

        // Check notifications table structure
        console.log('\n3. Checking notifications table structure...');
        const { data: notifStructure, error: notifError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', 'notifications')
            .order('ordinal_position');

        if (notifError) {
            console.error('Error checking notifications structure:', notifError);
        } else {
            console.log('Notifications table structure:', notifStructure);
        }

        // Check if admin_id exists in users table
        console.log('\n4. Checking if admin_id exists in users...');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa');

        if (usersError) {
            console.error('Error checking users:', usersError);
        } else {
            console.log('Users found:', users);
        }

        // Check RLS policies on notifications table
        console.log('\n5. Checking RLS policies...');
        const { data: policies, error: policiesError } = await supabase
            .from('pg_policies')
            .select('policyname, tablename, permissive, roles, cmd')
            .eq('tablename', 'notifications');

        if (policiesError) {
            console.error('Error checking policies:', policiesError);
        } else {
            console.log('RLS policies:', policies);
        }

        // Test manual insert into notifications
        console.log('\n6. Testing manual insert into notifications...');
        const { data: manualInsert, error: manualError } = await supabase
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
            console.error('Manual insert error:', manualError);
        } else {
            console.log('Manual insert successful:', manualInsert);

            // Clean up
            await supabase
                .from('notifications')
                .delete()
                .eq('id', manualInsert.id);
            console.log('Manual test notification cleaned up');
        }

        // Check if we can see the function in a different way
        console.log('\n7. Checking function using different approach...');
        try {
            const { data: funcCheck, error: funcCheckError } = await supabase
                .from('information_schema.routines')
                .select('routine_name, routine_type, routine_definition')
                .eq('routine_name', 'notify_admin_on_job_status_change');

            if (funcCheckError) {
                console.error('Error checking function via information_schema:', funcCheckError);
            } else {
                console.log('Function via information_schema:', funcCheck);
            }
        } catch (e) {
            console.log('Error with information_schema approach:', e);
        }

        // Check if we can see the trigger in a different way
        console.log('\n8. Checking trigger using different approach...');
        try {
            const { data: triggerCheck, error: triggerCheckError } = await supabase
                .from('information_schema.triggers')
                .select('trigger_name, event_manipulation, action_timing, action_statement')
                .eq('trigger_name', 'job_status_notification_trigger');

            if (triggerCheckError) {
                console.error('Error checking trigger via information_schema:', triggerCheckError);
            } else {
                console.log('Trigger via information_schema:', triggerCheck);
            }
        } catch (e) {
            console.log('Error with information_schema approach:', e);
        }

        console.log('\n🔍 Migration verification complete!');

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyMigration(); 