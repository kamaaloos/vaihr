import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { supabaseMigration } from '../src/config/supabaseMigration';

async function checkPermissions() {
    try {
        console.log('Checking database permissions...\n');

        // 1. Check users table access
        console.log('1. Checking users table access...');
        const { data: users, error: usersError } = await supabaseMigration
            .from('users')
            .select('*')
            .limit(5);

        if (usersError) {
            console.error('Error accessing users table:', usersError);
        } else {
            console.log(`✓ Successfully accessed users table. Found ${users.length} users.`);
            console.log('Sample user data:', users[0]);
        }

        // 2. Check jobs table access
        console.log('\n2. Checking jobs table access...');
        const { data: jobs, error: jobsError } = await supabaseMigration
            .from('jobs')
            .select('*')
            .limit(5);

        if (jobsError) {
            console.error('Error accessing jobs table:', jobsError);
        } else {
            console.log(`✓ Successfully accessed jobs table. Found ${jobs.length} jobs.`);
            if (jobs.length > 0) {
                console.log('Sample job data:', jobs[0]);
            }
        }

        // 3. Check user_status table access
        console.log('\n3. Checking user_status table access...');
        const { data: statuses, error: statusError } = await supabaseMigration
            .from('user_status')
            .select('*')
            .limit(5);

        if (statusError) {
            console.error('Error accessing user_status table:', statusError);
        } else {
            console.log(`✓ Successfully accessed user_status table. Found ${statuses.length} status records.`);
            if (statuses.length > 0) {
                console.log('Sample status data:', statuses[0]);
            }
        }

        // 4. Test write permissions on jobs table
        console.log('\n4. Testing write permissions...');
        const testJob = {
            title: 'Test Job',
            description: 'Test job for permissions check',
            status: 'new',
            admin_id: users?.[0]?.id // Use first user as admin
        };

        const { data: insertedJob, error: insertError } = await supabaseMigration
            .from('jobs')
            .insert(testJob)
            .select()
            .single();

        if (insertError) {
            console.error('Error testing job insertion:', insertError);
        } else {
            console.log('✓ Successfully tested job insertion:', insertedJob.id);

            // Clean up test job
            const { error: deleteError } = await supabaseMigration
                .from('jobs')
                .delete()
                .eq('id', insertedJob.id);

            if (deleteError) {
                console.error('Error cleaning up test job:', deleteError);
            } else {
                console.log('✓ Successfully cleaned up test job');
            }
        }

    } catch (error) {
        console.error('Error checking permissions:', error);
    }
}

checkPermissions(); 