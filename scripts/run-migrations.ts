import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load migration-specific environment variables
config({ path: resolve(__dirname, '../.env.migration') });

// Define migrations directory path
const MIGRATIONS_DIR = path.join(__dirname, '../src/migrations');

// Debug environment variables
console.log('Environment variables loaded from:', resolve(__dirname, '../.env.migration'));
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('Supabase key length:', process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.length ?? 0);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper function to wait for specified milliseconds
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Execute SQL with retry mechanism
async function executeSql(sql: string, retries = 3, backoff = 2000): Promise<void> {
    try {
        // First try using the Supabase client directly
        const { error: clientError } = await supabase.rpc('run_sql', {
            query: sql
        });

        if (clientError) {
            console.log('Supabase client error, falling back to REST API:', clientError.message);

            // Fall back to REST API
            const headers = new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
                'Prefer': 'return=minimal'
            });

            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/run_sql`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query: sql })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to execute SQL: ${text}`);
            }
        }
    } catch (error: any) {
        // Check if it's worth retrying
        const isRetryable =
            error.message?.includes('schema cache') ||
            error.code === 'ENOTFOUND' ||
            error.code === 'PGRST002';

        // If we have retries left and the error is retryable, try again
        if (retries > 0 && isRetryable) {
            console.log(`Retrying in ${backoff}ms... (${retries} retries left)`);
            await sleep(backoff);
            return executeSql(sql, retries - 1, backoff * 2);
        }

        // No more retries or not a retryable error
        if (error.code === 'ENOTFOUND') {
            console.error('Network error: Cannot connect to Supabase. Please check your internet connection and Supabase URL.');
        }
        throw error;
    }
}

// Add this list of migrations to skip
const MIGRATIONS_TO_SKIP = [
    '013_add_user_status_rpc.sql',
    '018_sync_user_online_status.sql',
    '020_fix_jobs_admin_relationship.sql',
    // Add other problematic migrations here
];

async function runMigration(migrationFile: string): Promise<void> {
    // Skip problematic migrations
    if (MIGRATIONS_TO_SKIP.includes(migrationFile)) {
        console.log(`Skipping problematic migration: ${migrationFile}`);
        return;
    }

    console.log(`Running migration: ${migrationFile}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFile), 'utf8');

    // For large SQL files, we'll break them into smaller chunks
    // This helps with the schema cache issues
    const MAX_CHUNK_SIZE = 5000; // characters

    if (sql.length > MAX_CHUNK_SIZE) {
        console.log(`Migration file is large (${sql.length} chars), breaking into chunks...`);

        // Split by semicolons, but keep the semicolon
        const statements = sql.split(/(?<=;)/g).filter(s => s.trim().length > 0);
        console.log(`Found ${statements.length} statements`);

        let currentChunk = '';
        let chunkNumber = 1;

        for (const statement of statements) {
            // If this statement would push us over the limit, execute the current chunk
            if (currentChunk.length + statement.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
                console.log(`Executing chunk ${chunkNumber}...`);
                try {
                    await executeSql(currentChunk);
                    console.log(`Chunk ${chunkNumber} executed successfully`);
                } catch (error) {
                    console.error(`Error executing chunk ${chunkNumber}:`, error);
                    throw error;
                }

                // Reset for next chunk
                currentChunk = '';
                chunkNumber++;

                // Add a delay between chunks to allow schema cache to update
                console.log('Waiting for schema cache to update...');
                await sleep(2000);
            }

            currentChunk += statement;
        }

        // Execute any remaining SQL
        if (currentChunk.length > 0) {
            console.log(`Executing final chunk ${chunkNumber}...`);
            try {
                await executeSql(currentChunk);
                console.log(`Final chunk executed successfully`);
            } catch (error) {
                console.error(`Error executing final chunk:`, error);
                throw error;
            }
        }
    } else {
        // For smaller files, execute the entire SQL at once
        try {
            await executeSql(sql);
        } catch (error) {
            console.error(`Error running migration ${migrationFile}:`, error);
            throw error;
        }
    }

    // Add a delay between migrations to allow schema cache to update
    await sleep(1000);
}

async function createMigrationsTable() {
    try {
        // First check if migrations table exists
        const { error: tableError } = await supabase.from('_migrations').select('id').limit(1);

        if (tableError && tableError.message.includes('relation "_migrations" does not exist')) {
            console.log('Creating migrations table...');

            const sql = `
                CREATE TABLE IF NOT EXISTS _migrations (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    executed_at TIMESTAMP WITH TIME ZONE NOT NULL
                );
            `;

            await executeSql(sql);
            console.log('Successfully created migrations table');
        } else {
            console.log('Migrations table already exists');
        }
    } catch (error) {
        console.error('Error creating migrations table:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Creating migrations table if it doesn\'t exist...');
        await createMigrationsTable();

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log('Found migration files:', files);

        for (const file of files) {
            await runMigration(file);
        }

        console.log('All migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main(); 