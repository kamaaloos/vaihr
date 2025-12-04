import { supabaseMigration } from '../src/config/supabaseMigration';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to check if a string is a valid UUID
function isValidUUID(str: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

// Function to safely delete records based on user ID
async function safeDeleteUserRecords(table: string, userId: string) {
    try {
        console.log(`Attempting to delete from ${table} table...`);

        // Skip if userId is not in correct format for the table
        if (table === 'user_status' && !isValidUUID(userId)) {
            console.log(`Skipping ${table} deletion - invalid UUID format`);
            return;
        }

        const { error } = await supabaseMigration
            .from(table)
            .delete()
            .eq('user_id', userId);

        if (error) {
            // Log but don't throw for "relation does not exist" errors
            if (error.message.includes('does not exist')) {
                console.log(`Table ${table} does not exist, skipping`);
                return;
            }
            throw error;
        }
        console.log(`Successfully deleted from ${table} table`);
    } catch (error) {
        console.error(`Error deleting from ${table} table:`, error);
        // Don't throw the error, just log it and continue
    }
}

async function deleteExistingUser() {
    try {
        console.log('Checking for existing users...');

        // First check if user exists in database
        const { data: dbUser } = await supabaseMigration
            .from('users')
            .select('id, email')
            .eq('email', 'admin@admin.com')
            .single();

        if (dbUser) {
            console.log('Found existing user in database, cleaning up related records...');

            // First, update all jobs to remove references to this user
            console.log('Updating jobs to remove user references...');
            const { error: jobUpdateError } = await supabaseMigration
                .from('jobs')
                .update({
                    driver_id: null,
                    assigned_to: null,
                    driver_name: null,
                    updated_at: new Date().toISOString()
                })
                .or(`driver_id.eq.${dbUser.id},assigned_to.eq.${dbUser.id}`);

            if (jobUpdateError) {
                console.error('Error updating jobs:', jobUpdateError);
                throw jobUpdateError;
            }
            console.log('Successfully removed job references');

            // Double check no jobs are referencing this user
            const { data: jobsCheck, error: jobsCheckError } = await supabaseMigration
                .from('jobs')
                .select('id')
                .or(`driver_id.eq.${dbUser.id},assigned_to.eq.${dbUser.id},admin_id.eq.${dbUser.id}`);

            if (jobsCheckError) {
                console.error('Error checking jobs:', jobsCheckError);
                throw jobsCheckError;
            }

            if (jobsCheck && jobsCheck.length > 0) {
                console.log('Found jobs still referencing user, deleting them...');
                const { error: jobsDeleteError } = await supabaseMigration
                    .from('jobs')
                    .delete()
                    .or(`driver_id.eq.${dbUser.id},assigned_to.eq.${dbUser.id},admin_id.eq.${dbUser.id}`);

                if (jobsDeleteError) {
                    console.error('Error deleting jobs:', jobsDeleteError);
                    throw jobsDeleteError;
                }
                console.log('Successfully deleted referencing jobs');
            }

            // Delete from all related tables
            const tables = ['status', 'user_status', 'notifications', 'messages'];
            for (const table of tables) {
                await safeDeleteUserRecords(table, dbUser.id);
            }

            // Finally delete the user
            console.log('Deleting user from users table...');
            const { error: deleteError } = await supabaseMigration
                .from('users')
                .delete()
                .eq('id', dbUser.id);

            if (deleteError) {
                console.error('Error deleting from users table:', deleteError);
                throw deleteError;
            }
            console.log('Successfully deleted from users table');
        }

        // Get auth user
        const { data: users } = await supabaseMigration.auth.admin.listUsers();
        const adminUser = users.users.find(u => u.email === 'admin@admin.com');

        if (adminUser) {
            console.log('Found existing user in auth system, deleting...');
            const { error: deleteAuthError } = await supabaseMigration.auth.admin.deleteUser(adminUser.id);
            if (deleteAuthError) {
                console.error('Error deleting auth user:', deleteAuthError);
                throw deleteAuthError;
            }
            console.log('Successfully deleted from auth system');
        }

        // Wait for deletions to complete
        await delay(2000);
    } catch (error) {
        console.error('Error in deleteExistingUser:', error);
        throw error;
    }
}

async function createAdmin() {
    try {
        console.log('Starting admin user creation process...');

        // First, clean up any existing admin user
        console.log('Cleaning up existing admin user...');
        await deleteExistingUser();

        // Wait a bit after cleanup
        await delay(3000);

        // Generate a proper UUID for the new user
        const newUserId = uuidv4();

        console.log('Creating new admin user in auth system...');
        // Create new auth user with the generated UUID
        const { data: { user }, error: createError } = await supabaseMigration.auth.admin.createUser({
            id: newUserId,
            email: 'admin@admin.com',
            password: 'Welcome123!',
            email_confirm: true,
            user_metadata: {
                name: 'Admin',
                role: 'admin'
            },
            app_metadata: {
                provider: 'email',
                role: 'admin'
            }
        });

        if (createError) {
            console.error('Error creating auth user:', createError);
            return;
        }

        if (!user) {
            console.error('No user returned from createUser');
            return;
        }

        console.log('Auth user created successfully. Waiting before database update...');
        await delay(3000);

        console.log('Creating user profile in database...');
        // Create user profile with upsert to handle any race conditions
        const { error: profileError } = await supabaseMigration
            .from('users')
            .upsert({
                id: user.id,
                email: 'admin@admin.com',
                name: 'Admin',
                role: 'admin',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (profileError) {
            console.error('Error creating user profile:', profileError);
            // If profile creation fails, clean up auth user
            await supabaseMigration.auth.admin.deleteUser(user.id);
            return;
        }

        console.log('Waiting for database propagation...');
        await delay(3000);

        // Verify the user exists in both systems
        const { data: authCheck } = await supabaseMigration.auth.admin.getUserById(user.id);
        const { data: dbCheck } = await supabaseMigration
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!authCheck?.user || !dbCheck) {
            console.error('Verification failed. User not found in one or both systems.');
            await deleteExistingUser();
            return;
        }

        console.log('\nAdmin user created successfully!');
        console.log('Email: admin@admin.com');
        console.log('Password: Welcome123!');
        console.log('User ID:', user.id);
        console.log('\nPlease try logging in with these credentials.');

    } catch (error) {
        console.error('Error in createAdmin:', error);
        await deleteExistingUser();
    }
}

createAdmin(); 