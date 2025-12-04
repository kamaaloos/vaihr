import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

interface Job {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    driver_id?: string;
    admin_id: string;
    admin_name?: string;
    admin_avatar_url?: string;
    pickup_location: string;
    delivery_location: string;
    pickup_date: string;
    delivery_date: string;
    created_at: string;
    updated_at: string;
}

interface JobWithAdmin extends Omit<Job, 'admin_name' | 'admin_avatar_url'> {
    admin: {
        email: string | null;
        name: string | null;
        avatar_url: string | null;
    } | null;
}

const convertToUUID = (id: string): string => {
    try {
        // If it's already a valid UUID, return it
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            return id;
        }
        // Otherwise, generate a deterministic UUID based on the input
        const bytes = new Uint8Array(16);
        const chars = Array.from(id);
        for (let i = 0; i < Math.min(chars.length, 16); i++) {
            bytes[i] = chars[i].charCodeAt(0);
        }
        return uuidv4({ random: bytes });
    } catch (error) {
        console.error('Error converting to UUID:', error);
        throw error;
    }
};

export const useJobs = () => {
    const { user, userData, loading: authLoading } = useAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Fetching jobs...');

            const { data, error } = await supabase
                .from('jobs')
                .select(`
                    *,
                    admin:users!admin_id (
                        email,
                        name,
                        avatar_url
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching jobs:', error);
                throw error;
            }

            if (!data) {
                console.warn('No data returned from jobs table');
                setJobs([]);
                return;
            }

            console.log(`Retrieved ${data.length} jobs`);

            // Transform the data to match the Job interface
            const transformedData = (data as unknown as JobWithAdmin[]).map(job => ({
                ...job,
                driver_id: job.driver_id || undefined,
                admin_name: job.admin?.name || job.admin?.email || undefined,
                admin_avatar_url: job.admin?.avatar_url || undefined
            })) as Job[];

            // Apply status filter if provided
            let filteredData = transformedData;
            if (userData.role === 'driver') {
                if (userData.status === 'open') {
                    // For open jobs, show all available jobs
                    filteredData = filteredData.filter(job =>
                        job.status === 'open' && !job.driver_id
                    );
                    console.log(`Filtered to ${filteredData.length} open jobs`);
                } else {
                    // For other statuses, show only assigned jobs
                    filteredData = filteredData.filter(job =>
                        job.driver_id === userData.uuid
                    );
                    console.log(`Filtered to ${filteredData.length} assigned jobs`);
                }
            }

            setJobs(filteredData);
        } catch (err: unknown) {
            console.error('Error fetching jobs:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) {
            console.log('Auth is still loading, waiting...');
            return;
        }

        if (!userData) {
            console.log('User data not yet available, waiting...');
            return;
        }

        let isMounted = true;
        let retryTimeout: NodeJS.Timeout | null = null;

        const attemptFetch = async () => {
            let attempts = 0;
            const maxAttempts = 3;
            const retryDelay = 1000; // 1 second

            while (attempts < maxAttempts) {
                try {
                    await fetchJobs();
                    // If we get here, fetch was successful
                    break;
                } catch (err) {
                    console.error(`Attempt ${attempts + 1} failed:`, err);
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`Retrying in ${retryDelay}ms... (Attempt ${attempts + 1} of ${maxAttempts})`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
        };

        attemptFetch();

        // Subscribe to job changes
        const subscription = supabase
            .channel('jobs_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs'
                },
                (payload) => {
                    console.log('Job change received:', payload);
                    if (isMounted) {
                        attemptFetch();
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
            subscription.unsubscribe();
        };
    }, [userData, authLoading]);

    const updateJob = async (jobId: string, updates: Partial<Omit<Job, 'admin_name' | 'admin_avatar_url'>>) => {
        try {
            const updatedData = {
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Convert driver_id to UUID if present
            if (updatedData.driver_id) {
                updatedData.driver_id = convertToUUID(updatedData.driver_id);
            }

            // First update the base jobs table
            const { error: updateError } = await supabase
                .from('jobs')
                .update(updatedData)
                .eq('id', jobId);

            if (updateError) throw updateError;

            // Then fetch the updated job with admin info
            const { data, error: fetchError } = await supabase
                .from('jobs')
                .select(`
                    *,
                    admin:users!admin_id (
                        email,
                        name,
                        avatar_url
                    )
                `)
                .eq('id', jobId)
                .single();

            if (fetchError) throw fetchError;
            if (!data) throw new Error('No data returned from fetch');

            // Transform the data to match the Job interface
            const transformedJob = {
                ...(data as unknown as JobWithAdmin),
                driver_id: (data as unknown as JobWithAdmin).driver_id || undefined,
                admin_name: (data as unknown as JobWithAdmin).admin?.name || (data as unknown as JobWithAdmin).admin?.email || undefined,
                admin_avatar_url: (data as unknown as JobWithAdmin).admin?.avatar_url || undefined
            } as Job;

            // Update the jobs list with the new job data
            setJobs(prevJobs =>
                prevJobs.map(job =>
                    job.id === jobId ? transformedJob : job
                )
            );

            return transformedJob;
        } catch (err) {
            console.error('Error updating job:', err);
            throw err;
        }
    };

    const createJob = async (jobData: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'admin_id' | 'admin_name' | 'admin_avatar_url'>) => {
        try {
            if (!user?.id) throw new Error('User not authenticated');

            // First create the job in the base table
            const { data, error } = await supabase
                .from('jobs')
                .insert([
                    {
                        ...jobData,
                        admin_id: convertToUUID(user.id),
                        driver_id: jobData.driver_id ? convertToUUID(jobData.driver_id) : null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('No data returned from insert');

            // Then fetch the created job with admin info
            const { data: jobWithAdmin, error: fetchError } = await supabase
                .from('jobs')
                .select(`
                    *,
                    admin:users!admin_id (
                        email,
                        name,
                        avatar_url
                    )
                `)
                .eq('id', data.id)
                .single();

            if (fetchError) throw fetchError;
            if (!jobWithAdmin) throw new Error('No data returned from fetch');

            // Transform the data to match the Job interface
            const transformedJob = {
                ...(jobWithAdmin as unknown as JobWithAdmin),
                driver_id: (jobWithAdmin as unknown as JobWithAdmin).driver_id || undefined,
                admin_name: (jobWithAdmin as unknown as JobWithAdmin).admin?.name || (jobWithAdmin as unknown as JobWithAdmin).admin?.email || undefined,
                admin_avatar_url: (jobWithAdmin as unknown as JobWithAdmin).admin?.avatar_url || undefined
            } as Job;

            // Update the jobs list with the new job
            setJobs(prevJobs => [...prevJobs, transformedJob]);

            return transformedJob;
        } catch (err) {
            console.error('Error creating job:', err);
            throw err;
        }
    };

    const deleteJob = async (jobId: string) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', jobId);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting job:', err);
            throw err;
        }
    };

    return {
        jobs,
        loading: loading && !initialized,
        error,
        initialized,
        createJob,
        updateJob,
        deleteJob
    };
}; 