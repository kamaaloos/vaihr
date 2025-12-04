import { supabaseMigration } from '../config/supabaseMigration';
import backup from '../../backup.json';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

interface User {
    email: string;
    name: string;
    role: 'admin' | 'driver';
    profileImage?: string;
    phoneNumber?: string;
    address?: string;
    companyInfo?: string;
    bankInfo?: string;
    expoPushToken?: string;
    online?: boolean;
    driverType?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface Job {
    title: string;
    description: string;
    location: string;
    date: string;
    duration: string;
    rate: string;
    status?: string;
    adminId?: string;
    driverId?: string;
    driverName?: string;
    imageUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface UserStatus {
    online?: boolean;
    lastActive?: string;
    lastSeen?: string;
    platform?: string;
    platformVersion?: string;
}

interface BackupData {
    __collections__: {
        users?: Record<string, User>;
        jobs?: Record<string, Job>;
        userStatus?: Record<string, UserStatus>;
    };
}

const convertDate = (dateStr: string | undefined) => {
    if (!dateStr) return undefined;
    return new Date(dateStr).toISOString();
};

// Keep track of ID mappings
const idMappings = new Map<string, string>();

const getOrCreateUUID = (oldId: string): string => {
    if (!idMappings.has(oldId)) {
        idMappings.set(oldId, uuidv4());
    }
    const newId = idMappings.get(oldId);
    if (!newId) {
        // This should never happen, but we need to satisfy TypeScript
        const generatedId = uuidv4();
        idMappings.set(oldId, generatedId);
        return generatedId;
    }
    return newId;
};

export const migrateData = async () => {
    console.log('Starting migration process...');
    const successfulUserMigrations = new Set<string>();
    const successfulJobMigrations = new Set<string>();

    try {
        // Read the backup file
        const backupPath = path.join(__dirname, '../../backup.json');
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8')) as BackupData;
        const collections = backupData.__collections__;

        if (!collections) {
            throw new Error('No collections found in backup data');
        }

        // Migrate Users first
        if (collections.users) {
            console.log('Starting user migration...');
            for (const [oldId, user] of Object.entries(collections.users)) {
                console.log(`Migrating user: ${oldId}`);
                const newId = getOrCreateUUID(oldId);

                try {
                    // Log more details about the user being migrated
                    console.log(`Migrating user details:`, {
                        email: user.email,
                        role: user.role,
                        oldId,
                        newId
                    });

                    // First create the auth user with proper configuration
                    const { data: authData, error: authError } = await supabaseMigration.auth.admin.createUser({
                        id: newId,
                        email: user.email,
                        password: 'Welcome123!', // This will be hashed automatically
                        email_confirm: true,
                        user_metadata: {
                            name: user.name,
                            role: user.role
                        },
                        app_metadata: {
                            provider: 'email',
                            role: user.role
                        }
                    });

                    if (authError) {
                        console.error(`Error creating auth user ${oldId}:`, authError);
                        if (authError.message.includes('duplicate key value violates unique constraint')) {
                            console.log(`User ${user.email} already exists, attempting to update...`);
                            // Try to update the user instead
                            const { error: updateError } = await supabaseMigration.auth.admin.updateUserById(
                                newId,
                                {
                                    email: user.email,
                                    password: 'Welcome123!',
                                    email_confirm: true,
                                    user_metadata: {
                                        name: user.name,
                                        role: user.role
                                    },
                                    app_metadata: {
                                        provider: 'email',
                                        role: user.role
                                    }
                                }
                            );
                            if (updateError) {
                                console.error(`Error updating existing user ${oldId}:`, updateError);
                                continue;
                            }
                        } else {
                            continue;
                        }
                    }

                    // Verify the user was created in auth
                    const { data: verifyData, error: verifyError } = await supabaseMigration
                        .from('users')
                        .select('*')
                        .eq('email', user.email)
                        .single();

                    if (verifyError || !verifyData) {
                        console.error(`Error verifying user ${user.email}:`, verifyError);
                        console.log('Attempting to fix user profile...');
                    }

                    // Then create the user profile
                    const newUser = {
                        ...user,
                        created_at: convertDate(user.createdAt),
                        updated_at: convertDate(user.updatedAt)
                    };

                    const { data: result, error } = await supabaseMigration.from('users').upsert(newUser).select();

                    if (error) {
                        console.error(`Error migrating user ${oldId}:`, error);
                    } else {
                        console.log(`Successfully migrated user ${oldId} to ${newId}`);
                        console.log(`User can login with email: ${user.email} and password: Welcome123!`);
                        successfulUserMigrations.add(oldId);
                    }
                } catch (error) {
                    console.error(`Error in user migration process for ${oldId}:`, error);
                }
            }
            console.log('User migration completed');
            console.log('Successfully migrated users:', Array.from(successfulUserMigrations));
        }

        // Migrate Jobs
        if (collections.jobs) {
            console.log('Starting job migration...');
            for (const [oldId, job] of Object.entries(collections.jobs)) {
                try {
                    const newId = getOrCreateUUID(oldId);
                    const adminId = job.adminId ? getOrCreateUUID(job.adminId) : null;
                    const driverId = job.driverId ? getOrCreateUUID(job.driverId) : null;

                    const newJob = {
                        ...job,
                        created_at: convertDate(job.createdAt),
                        updated_at: convertDate(job.updatedAt)
                    };

                    const { data: result, error } = await supabaseMigration.from('jobs').upsert({
                        id: newId,
                        title: newJob.title,
                        description: newJob.description,
                        location: newJob.location,
                        date: newJob.date,
                        duration: newJob.duration,
                        rate: newJob.rate,
                        status: newJob.status || 'new',
                        admin_id: adminId,
                        driver_id: driverId,
                        driver_name: newJob.driverName,
                        image_url: newJob.imageUrl,
                        created_at: newJob.created_at,
                        updated_at: newJob.updated_at
                    }).select();

                    if (error) {
                        console.error(`Error migrating job ${oldId}:`, error);
                    } else {
                        console.log(`Successfully migrated job ${oldId} to ${newId}`);
                        successfulJobMigrations.add(oldId);
                    }
                } catch (error) {
                    console.error(`Error in job migration process for ${oldId}:`, error);
                }
            }
            console.log('Job migration completed');
            console.log('Successfully migrated jobs:', Array.from(successfulJobMigrations));
        }

        // Migrate user status
        if (collections.userStatus) {
            console.log('Starting user status migration...');
            for (const [oldId, status] of Object.entries(collections.userStatus)) {
                try {
                    // Only migrate status if the user was successfully migrated
                    if (!successfulUserMigrations.has(oldId)) {
                        console.log(`Skipping user status for ${oldId} - user was not successfully migrated`);
                        continue;
                    }

                    const userId = getOrCreateUUID(oldId);
                    console.log(`Migrating user status for ${oldId} -> ${userId}`);

                    const newStatus = {
                        user_id: userId,
                        ...status,
                        last_active: convertDate(status.lastActive),
                        last_seen: convertDate(status.lastSeen)
                    };

                    const { error } = await supabaseMigration.from('user_status').upsert(newStatus);

                    if (error) {
                        console.error(`Error migrating user status for ${oldId}:`, error);
                    } else {
                        console.log(`Successfully migrated user status for ${oldId}`);
                    }
                } catch (error) {
                    console.error(`Error in user status migration for ${oldId}:`, error);
                }
            }
            console.log('User status migration completed');
        }

        console.log('Migration completed successfully');
        return {
            users: Array.from(successfulUserMigrations),
            jobs: Array.from(successfulJobMigrations)
        };
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
};

// Helper function to run the migration
export const runMigration = async () => {
    try {
        console.log('Starting data migration to Supabase...');
        const result = await migrateData();
        console.log('Migration completed successfully!');
        console.log('Migration summary:');
        console.log(`- Users migrated: ${result.users.length}`);
        console.log(`- Jobs migrated: ${result.jobs.length}`);
        return result;
    } catch (error) {
        console.error('Migration failed:', error);
        if (error instanceof Error) {
            throw new Error(`Migration failed: ${error.message}`);
        }
        throw new Error('Migration failed with unknown error');
    }
}; 