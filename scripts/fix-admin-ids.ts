import { config } from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { supabaseMigration } from '../src/config/supabaseMigration';

async function checkAndFixIds() {
    try {
        console.log('Starting job ID fixes...');

        // Get all jobs where driver_id is null but driver_name exists
        const { data: jobsToFix, error: jobsError } = await supabaseMigration
            .from('jobs')
            .select('id, title, driver_id, driver_name')
            .is('driver_id', null)
            .not('driver_name', 'is', null);

        if (jobsError) {
            throw jobsError;
        }

        console.log(`Found ${jobsToFix?.length || 0} jobs with driver_name but no driver_id`);

        // Get all users to map names to IDs
        const { data: users, error: usersError } = await supabaseMigration
            .from('users')
            .select('id, name')
            .eq('role', 'driver');

        if (usersError) {
            throw usersError;
        }

        // Create a map of names to IDs
        const nameToId = new Map(users.map(user => [user.name.toLowerCase().trim(), user.id]));

        // Update each job with the correct driver ID
        let updatedCount = 0;
        let errorCount = 0;

        for (const job of jobsToFix || []) {
            if (job.driver_name) {
                const driverId = nameToId.get(job.driver_name.toLowerCase().trim());
                if (driverId) {
                    console.log(`Updating job ${job.id} - Setting driver_id to ${driverId} for driver ${job.driver_name}`);
                    const { error: updateError } = await supabaseMigration
                        .from('jobs')
                        .update({ driver_id: driverId })
                        .eq('id', job.id);

                    if (updateError) {
                        console.error(`Error updating job ${job.id}:`, updateError);
                        errorCount++;
                    } else {
                        updatedCount++;
                    }
                } else {
                    console.warn(`No matching ID found for driver name: "${job.driver_name}"`);
                    errorCount++;
                }
            }
        }

        console.log('\nUpdate Summary:');
        console.log(`- Total jobs processed: ${jobsToFix?.length || 0}`);
        console.log(`- Successfully updated: ${updatedCount}`);
        console.log(`- Errors/not found: ${errorCount}`);

        // Verify the updates
        const { data: verifyJobs, error: verifyError } = await supabaseMigration
            .from('jobs')
            .select('id, title, driver_id, driver_name, status')
            .not('driver_name', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!verifyError) {
            console.log('\nSample of jobs after updates:');
            console.log(JSON.stringify(verifyJobs, null, 2));
        }

    } catch (error) {
        console.error('Error fixing job IDs:', error);
    }
}

function isValidUUID(str: string) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(str);
}

checkAndFixIds(); 