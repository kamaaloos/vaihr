import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get environment variables directly
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

// Log configuration for debugging
console.log('Supabase Configuration:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey
});

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Environment variables:', {
        url: supabaseUrl,
        anonKey: !!supabaseAnonKey, // Log only existence for security
        serviceKey: !!supabaseServiceKey // Log only existence for security
    });
    throw new Error(
        'Missing Supabase configuration. Please check your environment variables.'
    );
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (
    input: RequestInfo | URL,
    init?: RequestInit,
    retries = MAX_RETRIES
): Promise<Response> => {
    try {
        console.log(`Fetching ${typeof input === 'string' ? input : input.toString()}...`);
        const response = await fetch(input, init);
        console.log(`Response status: ${response.status}`);

        if (!response.ok && retries > 0) {
            console.log(`Retrying request, ${retries} attempts remaining`);
            await delay(RETRY_DELAY);
            return fetchWithRetry(input, init, retries - 1);
        }

        return response;
    } catch (error) {
        if (retries > 0) {
            console.log(`Fetch failed, retrying... ${retries} attempts remaining`);
            await delay(RETRY_DELAY);
            return fetchWithRetry(input, init, retries - 1);
        }
        console.error('Fetch error after all retries:', error);
        throw error;
    }
};

// Create a service role client for migration (no auth storage needed)
export const supabaseMigration = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    global: {
        headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
        },
    },
});

// Create a custom fetch function with retry logic
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch(input, {
                    ...init,
                    signal: controller.signal
                });

                if (response.ok) {
                    return response;
                }

                if (response.status === 401 || response.status === 403) {
                    throw new Error('Authentication error');
                }

                if (attempt === maxRetries - 1) {
                    throw new Error(`Failed after ${maxRetries} attempts`);
                }
            } finally {
                clearTimeout(timeoutId);
            }

            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            console.warn(`Attempt ${attempt + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
        }
    }
    throw new Error('Failed to fetch after retries');
};

// Export regular client with auth for the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    global: {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch(input, {
                    ...init,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        }
    },
    db: {
        schema: 'public'
    },
    realtime: {
        params: {
            eventsPerSecond: 1
        }
    }
});

// Test connection with retries
const testConnection = async (retries = MAX_RETRIES) => {
    try {
        console.log('Testing connection to Supabase...');
        const startTime = Date.now();

        // Test the Supabase client with a simple query
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true })
            .limit(1);

        const endTime = Date.now();
        console.log(`Connection test took ${endTime - startTime}ms`);

        if (error) {
            console.warn('Initial connection test error:', error.message);
            if (retries > 0) {
                console.log(`Retrying connection test, ${retries} attempts remaining`);
                await delay(RETRY_DELAY);
                return testConnection(retries - 1);
            }
        } else {
            console.log('Successfully connected to Supabase');
        }
    } catch (error: unknown) {
        const err = error as Error;
        console.warn('Connection test error:', err.message);
        if (retries > 0) {
            console.log(`Retrying connection test, ${retries} attempts remaining`);
            await delay(RETRY_DELAY);
            return testConnection(retries - 1);
        }
    }
};

// Run connection test but don't block initialization
testConnection();

// Helper functions for common operations
export const getUser = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
};

export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

// Database helper functions
export const getErrorMessage = (error: any): string => {
    return error?.message || 'An unexpected error occurred';
};

// Generic database operations
export const fetchData = async <T>(
    table: string,
    query?: any
): Promise<T[]> => {
    try {
        let queryBuilder = supabase.from(table).select('*');

        if (query) {
            queryBuilder = { ...queryBuilder, ...query };
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;
        return data as T[];
    } catch (error) {
        console.error(`Error fetching ${table}:`, error);
        throw error;
    }
};

export const insertData = async <T>(
    table: string,
    data: Partial<T>
): Promise<T> => {
    try {
        const { data: insertedData, error } = await supabase
            .from(table)
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return insertedData as T;
    } catch (error) {
        console.error(`Error inserting into ${table}:`, error);
        throw error;
    }
};

export const updateData = async <T>(
    table: string,
    id: string | number,
    data: Partial<T>
): Promise<T> => {
    try {
        const { data: updatedData, error } = await supabase
            .from(table)
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return updatedData as T;
    } catch (error) {
        console.error(`Error updating ${table}:`, error);
        throw error;
    }
};

export const deleteData = async (
    table: string,
    id: string | number
): Promise<void> => {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error(`Error deleting from ${table}:`, error);
        throw error;
    }
};

// Helper function to check auth state
export const checkAuthState = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.access_token) {
            // Verify token has required claims
            const tokenParts = session.access_token.split('.');
            if (tokenParts.length !== 3) {
                throw new Error('Invalid token format');
            }

            const payload = JSON.parse(atob(tokenParts[1]));
            if (!payload.sub) {
                console.error('Token missing sub claim:', payload);
                // Force session refresh
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) throw refreshError;
            }
        }

        return session;
    } catch (error) {
        console.error('Auth state check failed:', error);
        return null;
    }
};

// Add a health check function
export const checkSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase health check failed:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}; 