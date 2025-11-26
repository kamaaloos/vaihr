import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { User } from '@supabase/supabase-js';

export const useSupabaseAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signUp = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    };

    return {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
    };
};

export const useSupabaseQuery = <T>(
    table: string,
    query?: {
        column?: string;
        operator?: string;
        value?: any;
        orderBy?: string;
        ascending?: boolean;
    }
) => {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let queryBuilder = supabase.from(table).select('*');

        if (query?.column && query?.operator && query?.value !== undefined) {
            queryBuilder = queryBuilder.filter(query.column, query.operator, query.value);
        }

        if (query?.orderBy) {
            queryBuilder = queryBuilder.order(query.orderBy, {
                ascending: query?.ascending ?? true,
            });
        }

        const subscription = queryBuilder.on('*', (payload) => {
            setData((current) => {
                if (payload.eventType === 'DELETE') {
                    return current.filter((item: any) => item.id !== payload.old.id);
                }
                if (payload.eventType === 'INSERT') {
                    return [...current, payload.new];
                }
                if (payload.eventType === 'UPDATE') {
                    return current.map((item: any) =>
                        item.id === payload.new.id ? payload.new : item
                    );
                }
                return current;
            });
        }).subscribe();

        queryBuilder
            .then(({ data, error }) => {
                if (error) setError(error);
                else setData(data || []);
                setLoading(false);
            });

        return () => {
            subscription.unsubscribe();
        };
    }, [table, JSON.stringify(query)]);

    return { data, loading, error };
};

export const useSupabaseStorage = () => {
    const uploadFile = async (
        bucket: string,
        path: string,
        file: File | Blob,
        options?: { contentType?: string }
    ) => {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, options);
        if (error) throw error;
        return data;
    };

    const getPublicUrl = (bucket: string, path: string) => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    };

    const deleteFile = async (bucket: string, path: string) => {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
    };

    return {
        uploadFile,
        getPublicUrl,
        deleteFile,
    };
}; 