import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
config({ path: resolve(__dirname, '../.env') });

// Verify the environment variables are loaded
console.log('Environment variables loaded:', {
    hasUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
});

import { supabaseMigration } from '../src/config/supabaseMigration';
import backup from '../backup.json';

interface BackupJob {
    title: string;
    description: string;
    location: string;
    date: string;
    duration: string;
    rate: string;
    status?: string;
    adminId?: string;
    driverId?: string;
    imageUrl?: string;
    createdAt?: { __datatype__: string; value: { _seconds: number; _nanoseconds: number; } };
    __collections__: {};
}

async function checkJobs() {
    try {
        // First, let's check the jobs in the backup file
        const backupJobs = backup.__collections__.jobs as Record<string, BackupJob>;

        // Log the structure of the first job to see available fields
        const firstJob = Object.values(backupJobs)[0];
        console.log('\nExample job structure:', JSON.stringify(firstJob, null, 2));

        console.log('\nJobs in backup file with driver assignments:');
        Object.entries(backupJobs)
            .filter(([_, job]) => job.driverId)
            .forEach(([id, job]) => {
                console.log(`Job ID: ${id}`);
                console.log('Job data:', JSON.stringify(job, null, 2));
                console.log('---');
            });

        // Now check jobs in Supabase
        const { data: supabaseJobs, error } = await supabaseMigration
            .from('jobs')
            .select('*');

        if (error) {
            console.error('Error fetching jobs:', error);
            return;
        }

        console.log('\nJobs in Supabase:');
        console.log(JSON.stringify(supabaseJobs, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

async function checkDriverJobs() {
    try {
        const driverId = '617e7a07-9a4d-4b92-9465-f8f6f52e910b';

        console.log('Checking jobs for driver:', driverId);

        // Check jobs directly assigned to driver
        const { data: assignedJobs, error: assignedError } = await supabaseMigration
            .from('jobs')
            .select('*')
            .eq('driver_id', driverId);

        if (assignedError) {
            console.error('Error fetching assigned jobs:', assignedError);
        } else {
            console.log('\nJobs assigned by driver_id:', assignedJobs.length);
            console.log(assignedJobs);
        }

        // Check jobs by driver name
        const { data: driver, error: driverError } = await supabaseMigration
            .from('users')
            .select('name')
            .eq('id', driverId)
            .single();

        if (driverError) {
            console.error('Error fetching driver:', driverError);
        } else if (driver) {
            const { data: nameJobs, error: nameError } = await supabaseMigration
                .from('jobs')
                .select('*')
                .eq('driver_name', driver.name);

            if (nameError) {
                console.error('Error fetching jobs by name:', nameError);
            } else {
                console.log('\nJobs assigned by driver_name:', nameJobs.length);
                console.log(nameJobs);
            }
        }

        // Check all jobs to see assignment patterns
        const { data: allJobs, error: allError } = await supabaseMigration
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (allError) {
            console.error('Error fetching all jobs:', allError);
        } else {
            console.log('\nRecent jobs (showing assignment patterns):');
            allJobs.forEach(job => {
                console.log({
                    id: job.id,
                    title: job.title,
                    status: job.status,
                    driver_id: job.driver_id,
                    driver_name: job.driver_name
                });
            });
        }

    } catch (error) {
        console.error('Error checking jobs:', error);
    }
}

checkJobs();
checkDriverJobs(); 