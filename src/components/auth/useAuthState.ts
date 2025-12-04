import { useState } from 'react';
import { User } from '@supabase/supabase-js';

export const useAuthState = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    return {
        user,
        userData,
        loading,
        error,
        setUser,
        setUserData,
        setLoading,
        setError,
    };
}; 