import { config } from 'dotenv';
import { resolve } from 'path';

// Load migration-specific environment variables first
config({ path: resolve(__dirname, '../.env.migration') });

// Verify the environment variables are loaded
console.log('Environment variables loaded:', {
    hasUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
});

import { migrateData } from '../src/utils/migration';
import * as fs from 'fs';
import * as path from 'path';

// Verify backup file exists and can be read
const backupPath = path.join(__dirname, '..', 'backup.json');
console.log('Checking backup file at:', backupPath);
try {
    const backupExists = fs.existsSync(backupPath);
    console.log('Backup file exists:', backupExists);
    if (backupExists) {
        const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        console.log('Backup file content structure:', Object.keys(backupContent));

        // Log collections structure
        if (backupContent.__collections__) {
            console.log('Collections found:', Object.keys(backupContent.__collections__));
            for (const [collection, data] of Object.entries(backupContent.__collections__)) {
                console.log(`${collection} count:`, Object.keys(data as object).length);
            }
        }
    }
} catch (error) {
    console.error('Error reading backup file:', error);
}

async function main() {
    try {
        console.log('Starting migration process...');
        await migrateData();
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main(); 