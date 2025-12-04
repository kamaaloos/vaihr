import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for migration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Migration environment variables missing');
    throw new Error('Missing Supabase URL or Service Role Key');
}

export const supabaseMigration = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

export const testConnection = async () => {
    try {
        const { error } = await supabaseMigration
            .from('users')
            .select('count', { count: 'exact', head: true });

        if (error) throw error;
        console.log('✅ Successfully connected to Supabase');
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to Supabase:', error);
        return false;
    }
};
