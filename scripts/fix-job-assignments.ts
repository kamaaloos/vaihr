import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { supabaseMigration } from '../src/config/supabaseMigration';

async function fixJobAssignments() {
    try {
        console.log('Starting job assignment fixes...');

        // First, get all users to map names to IDs
        const { data: users, error: userError } = await supabaseMigration
            .from('users')
            .select('id, name');

        if (userError) {
            throw userError;
        }

        // Create a map of names to IDs
        const nameToId = new Map(users.map(user => [user.name.trim(), user.id]));

        // Get all jobs with driver names but no driver IDs
        const { data: jobs, error: jobError } = await supabaseMigration
            .from('jobs')
            .select('*')
            .not('driver_name', 'is', null);

        if (jobError) {
            throw jobError;
        }

        console.log(`Found ${jobs.length} jobs with driver names`);

        // Update each job with the correct driver ID
        for (const job of jobs) {
            if (job.driver_name) {
                const driverId = nameToId.get(job.driver_name.trim());
                if (driverId) {
                    console.log(`Updating job ${job.id} with driver ID ${driverId}`);
                    const { error: updateError } = await supabaseMigration
                        .from('jobs')
                        .update({ driver_id: driverId })
                        .eq('id', job.id);

                    if (updateError) {
                        console.error(`Error updating job ${job.id}:`, updateError);
                    }
                } else {
                    console.warn(`No matching ID found for driver name: "${job.driver_name}"`);
                }
            }
        }

        console.log('Job assignment fixes completed');

        // Verify the updates
        const { data: updatedJobs, error: verifyError } = await supabaseMigration
            .from('jobs')
            .select('id, title, driver_id, driver_name, status')
            .not('driver_name', 'is', null);

        if (verifyError) {
            throw verifyError;
        }

        console.log('\nVerification of updated jobs:');
        console.log(JSON.stringify(updatedJobs, null, 2));

    } catch (error) {
        console.error('Error fixing job assignments:', error);
    }
}

fixJobAssignments(); 