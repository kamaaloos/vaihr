import { supabase } from '../config/supabase';
import { Job } from '../types';

interface JobWithAdmin {
    id: string;
    title: string;
    description: string;
    location: string;
    date: string;
    duration: string;
    rate: string;
    status: Job['status'];
    driver_id?: string;
    driver_name?: string;
    admin_id: string;
    admin?: {
        email?: string;
        name?: string;
        avatar_url?: string;
    };
    driver?: {
        email?: string;
        name?: string;
        avatar_url?: string;
    };
    image_url?: string;
    created_at: string;
    updated_at: string;
}

export const getJobs = async (): Promise<Job[]> => {
    try {
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

        if (error) throw error;
        if (!data) return [];

        // Transform the data to match the Job interface
        return (data as unknown as JobWithAdmin[]).map(job => ({
            ...job,
            driver_id: job.driver_id || undefined,
            driver_name: job.driver?.name || job.driver?.email || undefined,
            admin_name: job.admin?.name || job.admin?.email || undefined,
            admin_avatar_url: job.admin?.avatar_url || undefined
        })) as Job[];
    } catch (error) {
        console.error('Error fetching jobs:', error);
        throw error;
    }
};

export const getJobsByStatus = async (status: Job['status']): Promise<Job[]> => {
    try {
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
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data) return [];

        // Transform the data to match the Job interface
        return (data as unknown as JobWithAdmin[]).map(job => ({
            ...job,
            driver_id: job.driver_id || undefined,
            driver_name: job.driver?.name || job.driver?.email || undefined,
            admin_name: job.admin?.name || job.admin?.email || undefined,
            admin_avatar_url: job.admin?.avatar_url || undefined
        })) as Job[];
    } catch (error) {
        console.error('Error fetching jobs by status:', error);
        throw error;
    }
};

export const getJobsByStatusRange = async (status?: 'new' | 'processing' | 'completed'): Promise<Job[]> => {
    try {
        let query = supabase
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

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data) return [];

        // Transform the data to match the Job interface
        return (data as unknown as JobWithAdmin[]).map(job => ({
            ...job,
            driver_id: job.driver_id || undefined,
            driver_name: job.driver?.name || job.driver?.email || undefined,
            admin_name: job.admin?.name || job.admin?.email || undefined,
            admin_avatar_url: job.admin?.avatar_url || undefined
        })) as Job[];
    } catch (error) {
        console.error('Error fetching jobs by status:', error);
        throw error;
    }
}; 