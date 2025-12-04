import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { Job } from '../types';
import { convertToUUID } from '../utils/uuid';
import { useAuth } from './AuthContext';

interface JobWithAdmin extends Omit<Job, 'admin_name' | 'admin_avatar_url'> {
    admin: {
        email: string | null;
        name: string | null;
        avatar_url: string | null;
    } | null;
    driver: {
        email: string | null;
        name: string | null;
        avatar_url: string | null;
    } | null;
}

interface JobsContextType {
    jobs: Job[];
    loading: boolean;
    error: Error | null;
    updateJob: (jobId: string, updates: Partial<Job>) => Promise<void>;
    refreshJobs: () => Promise<void>;
    createJob: (jobData: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'admin_id' | 'admin_name' | 'admin_avatar_url'>) => Promise<Job>;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const JobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const { user } = useAuth();

    const refreshJobs = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('jobs')
                .select(`
                    *,
                    admin:users!admin_id (
                        email,
                        name,
                        avatar_url
                    ),
                    driver:users!driver_id (
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

            // Transform the data to match the Job interface
            const transformedData = (data as unknown as JobWithAdmin[]).map(job => ({
                ...job,
                driver_id: job.driver_id || undefined,
                driver_name: job.driver?.name || job.driver?.email || undefined,
                admin_name: job.admin?.name || job.admin?.email || undefined,
                admin_avatar_url: job.admin?.avatar_url || undefined
            })) as Job[];

            setJobs(transformedData);
        } catch (err) {
            console.error('Error refreshing jobs:', err);
            setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        } finally {
            setLoading(false);
        }
    };

    const updateJob = useCallback(async (jobId: string, updates: Partial<Job>) => {
        try {
            setLoading(true);
            const { error: updateError } = await supabase
                .from('jobs')
                .update(updates)
                .eq('id', jobId);

            if (updateError) throw updateError;

            // Fetch the updated job with admin info
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
        } catch (err) {
            console.error('Error updating job:', err);
            setError(err instanceof Error ? err : new Error('An unknown error occurred'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createJob = useCallback(async (jobData: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'admin_id' | 'admin_name' | 'admin_avatar_url'>) => {
        try {
            setLoading(true);
            setError(null);

            // First create the job in the base table
            const { data, error } = await supabase
                .from('jobs')
                .insert([
                    {
                        ...jobData,
                        admin_id: convertToUUID(user?.id || ''),
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
            setError(err instanceof Error ? err : new Error('An unknown error occurred'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    return (
        <JobsContext.Provider value={{ jobs, loading, error, updateJob, refreshJobs, createJob }}>
            {children}
        </JobsContext.Provider>
    );
};

export const useJobs = () => {
    const context = useContext(JobsContext);
    if (context === undefined) {
        throw new Error('useJobs must be used within a JobsProvider');
    }
    return context;
}; 