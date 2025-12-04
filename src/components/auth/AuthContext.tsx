import { createContext, useContext } from 'react';
import { User } from '@supabase/supabase-js';

export interface AuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, userData: any) => Promise<void>;
    signOut: () => Promise<void>;
    updateUserProfile: (data: any) => Promise<void>;
    updateUserData: (data: any) => void;
    clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 