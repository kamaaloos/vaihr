import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface Invoice {
    id: string;
    job_id: string;
    driver_id: string;
    admin_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
    updated_at: string;
    invoice_number: string;
    job_title: string;
    job_description: string;
    job_location: string;
    job_date: string;
    driver_name: string;
    driver_email: string;
    admin_name: string;
    admin_email: string;
}

export const useInvoices = () => {
    const { user, userData, loading: authLoading } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .rpc('get_invoices_with_details');

            if (error) {
                throw error;
            }

            setInvoices(data || []);
        } catch (err: any) {
            console.error('Error fetching invoices:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && user?.id) {
            fetchInvoices();
        }
    }, [user?.id, authLoading]);

    return {
        invoices,
        loading,
        error,
        refresh: fetchInvoices
    };
}; 