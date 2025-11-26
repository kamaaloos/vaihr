import React, { useState, useEffect, useRef } from 'react';
import { supabase, supabaseMigration } from '../../config/supabase';
import { User, Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import { useAuthState } from './useAuthState';
import { useAuthHandlers } from './useAuthHandlers';
import { useNavigation } from './useNavigation';
import { initializeOnlineStatus, cleanupOnlineStatus } from '../../services/OnlineStatusManager';
import Toast from 'react-native-toast-message';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isInitialized = useRef(false);

    if (!isInitialized.current) {
        console.log('AuthProvider: Initializing');
        isInitialized.current = true;
    }

    const { user, userData, loading, error, setUser, setUserData, setLoading, setError } = useAuthState();
    const { safeNavigate } = useNavigation();
    const { handleError, clearError, fetchUserData, signIn, signOut } = useAuthHandlers(setError, setLoading);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const initializeAuth = async () => {
            console.log('AuthProvider: Starting auth initialization');

            try {
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        console.log('AuthProvider: Session retrieval timed out');
                        reject(new Error('Session retrieval timed out'));
                    }, 10000);
                });

                console.log('AuthProvider: Getting session');
                const sessionPromise = supabase.auth.getSession();

                const { data: { session }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as { data: { session: Session | null }, error: Error | null };

                clearTimeout(timeoutId);

                if (error) {
                    console.error('AuthProvider: Session error:', error);
                    // Don't set error for invalid session, just log it
                    if (!error.message.includes('Invalid session')) {
                        setError(error.message);
                    }
                    setLoading(false);
                    return;
                }

                if (!session) {
                    console.log('AuthProvider: No valid session found - this is normal for new users');
                    setLoading(false);
                    return;
                }

                console.log('AuthProvider: Session found, fetching user data');
                const userData = await fetchUserData(session.user.id);

                if (userData) {
                    console.log('AuthProvider: User data fetched successfully');
                    // Merge auth user with user data
                    const mergedUser = {
                        ...session.user,
                        ...userData,
                        role: userData.role || session.user.user_metadata?.role || session.user.app_metadata?.role
                    };
                    console.log('AuthProvider: Setting merged user data:', mergedUser);
                    setUser(mergedUser);
                    setUserData(userData);

                    // Initialize online status for the user (both fresh login and session restoration)
                    try {
                        console.log(`🎯 AuthProvider: INITIALIZING ONLINE STATUS FOR SESSION RESTORATION - USER ${session.user.id}`);
                        console.log('AuthProvider: Initializing online status for user:', session.user.id);
                        await initializeOnlineStatus(session.user.id);
                        console.log('AuthProvider: Online status initialized for user:', session.user.id);
                    } catch (onlineError) {
                        console.error('AuthProvider: Failed to initialize online status:', onlineError);
                    }

                    if (userData.role === 'admin') {
                        safeNavigate('AdminHome');
                    } else {
                        safeNavigate('DriverHome');
                    }
                } else {
                    console.log('AuthProvider: No user data found');
                    setError('Failed to fetch user data');
                }
            } catch (error) {
                console.error('AuthProvider: Initialization error:', error);
                // Don't set error for timeout or session issues, just log them
                if (error instanceof Error && !error.message.includes('Session retrieval timed out')) {
                    setError('Error initializing auth');
                }
            } finally {
                console.log('AuthProvider: Initialization complete');
                setLoading(false);
            }
        };

        initializeAuth();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    useEffect(() => {
        console.log('AuthProvider: Setting up auth state change listener');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('AuthProvider: Auth state changed:', event);

            if (event === 'SIGNED_IN') {
                if (session) {
                    try {
                        const userData = await fetchUserData(session.user.id);
                        if (userData) {
                            // Merge auth user with user data
                            const mergedUser = {
                                ...session.user,
                                ...userData,
                                role: userData.role || session.user.user_metadata?.role || session.user.app_metadata?.role
                            };
                            console.log('AuthProvider: Setting merged user data:', mergedUser);
                            setUser(mergedUser);
                            setUserData(userData);
                            setLoading(false);

                            // Initialize online status for the signed-in user
                            try {
                                console.log(`🎯 AuthProvider: INITIALIZING ONLINE STATUS FOR FRESH LOGIN - USER ${session.user.id}`);
                                console.log('AuthProvider: Initializing online status for signed-in user');
                                await initializeOnlineStatus(session.user.id);
                                console.log('AuthProvider: Online status initialized for signed-in user');
                            } catch (onlineError) {
                                console.error('AuthProvider: Failed to initialize online status:', onlineError);
                            }
                        }
                    } catch (error) {
                        console.error('AuthProvider: Error fetching user data after sign in:', error);
                        setError('Error fetching user data');
                        setLoading(false);
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                console.log('AuthProvider: User signed out, cleaning up');

                // Cleanup online status
                try {
                    console.log('AuthProvider: Cleaning up online status on sign out');
                    await cleanupOnlineStatus();
                    console.log('AuthProvider: Online status cleaned up on sign out');
                } catch (onlineError) {
                    console.error('AuthProvider: Failed to cleanup online status on sign out:', onlineError);
                }

                setUser(null);
                setUserData(null);
                setError(null);
                if (window.presenceCleanup) {
                    window.presenceCleanup();
                }
                // Use a small delay to ensure state is updated before navigation
                setTimeout(() => {
                    safeNavigate('Welcome');
                }, 100);
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('AuthProvider: Token refreshed');
            }
        });

        return () => {
            console.log('AuthProvider: Cleaning up subscription');
            subscription.unsubscribe();
        };
    }, []);

    // Only log state changes when they actually change
    const prevState = useRef({ hasUser: !!user, hasUserData: !!userData, loading, hasError: !!error });
    const currentState = { hasUser: !!user, hasUserData: !!userData, loading, hasError: !!error };

    if (JSON.stringify(prevState.current) !== JSON.stringify(currentState)) {
        console.log('AuthProvider: Current state:', currentState);
        prevState.current = currentState;
    }

    const updateUserData = (data: any) => {
        // Only update if data is actually different
        if (JSON.stringify(userData) !== JSON.stringify(data)) {
            console.log('Updating user data:', data);
            setUserData(data);
        }
    };

    const authContextValue = {
        user,
        userData,
        loading,
        error,
        signIn,
        signUp: async (email: string, password: string, userData: any) => {
            try {
                console.log('🔍 SIGNUP DEBUG: Starting signup process');
                console.log('🔍 SIGNUP DEBUG: Email:', email);
                console.log('🔍 SIGNUP DEBUG: User data:', userData);
                console.log('🔍 SIGNUP DEBUG: Supabase client:', !!supabase);
                console.log('🔍 SIGNUP DEBUG: Supabase client initialized');

                setLoading(true);
                clearError();

                console.log('Starting signup process for:', email);

                // Create the user in Supabase Auth
                console.log('🔍 SIGNUP DEBUG: Calling supabase.auth.signUp...');
                // Standard signup without phone field
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email.toLowerCase().trim(),
                    password: password.trim(),
                    options: {
                        data: {
                            name: userData.name.trim(),
                            role: userData.role
                        }
                    }
                });

                console.log('🔍 SIGNUP DEBUG: Auth response:', { authData, authError });
                console.log('🔍 SIGNUP DEBUG: Auth error details:', authError?.message, authError?.status);

                if (authError) {
                    console.error('Signup auth error:', authError);
                    throw authError;
                }

                if (!authData.user) {
                    throw new Error('No user returned from signup');
                }

                console.log('Auth user created successfully:', authData.user.id);

                // Create user profile in the users table
                console.log('🔍 SIGNUP DEBUG: Creating user profile in database...');
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        email: email.toLowerCase().trim(),
                        name: userData.name.trim(),
                        role: userData.role || 'driver',
                        profile_completed: false,
                        email_verified: userData.email_verified || false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                console.log('🔍 SIGNUP DEBUG: Profile creation result:', { profileError });

                if (profileError) {
                    console.error('Profile creation error:', profileError);
                    // If profile creation fails, we should clean up the auth user
                    // But Supabase doesn't allow us to delete users from client side
                    throw new Error('Failed to create user profile');
                }

                console.log('User profile created successfully');

                // Show success message only if not using OTP flow
                if (!userData.email_verified) {
                    Toast.show({
                        type: 'success',
                        text1: 'Registration Successful',
                        text2: 'Please check your email to verify your account before logging in.',
                        position: 'bottom',
                        visibilityTime: 6000,
                    });
                }

            } catch (error: any) {
                console.error('🔍 SIGNUP DEBUG: Error caught:', error);
                console.error('🔍 SIGNUP DEBUG: Error type:', typeof error);
                console.error('🔍 SIGNUP DEBUG: Error message:', error.message);
                console.error('🔍 SIGNUP DEBUG: Error stack:', error.stack);

                let errorMessage = 'Failed to register';

                if (error.message.includes('email_address_invalid')) {
                    errorMessage = 'Please enter a valid email address';
                } else if (error.message.includes('already registered') || error.message.includes('already been registered')) {
                    errorMessage = 'This email is already registered';
                } else if (error.message.includes('password')) {
                    errorMessage = 'Password must be at least 6 characters';
                } else if (error.message.includes('network') || error.message.includes('connection')) {
                    errorMessage = 'Network error. Please check your connection';
                } else if (error.message.includes('rate limit')) {
                    errorMessage = 'Too many attempts. Please try again later';
                }

                setError(errorMessage);
                throw error;
            } finally {
                setLoading(false);
            }
        },
        signOut,
        updateUserProfile: async (data: any) => {
            // Implementation moved to useAuthHandlers
        },
        updateUserData,
        clearError
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
}; 