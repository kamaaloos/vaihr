import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from './useNavigation';
import NetInfo from '@react-native-community/netinfo';
import { Keyboard } from 'react-native';
import { Platform } from 'react-native';
import { initializeOnlineStatus, cleanupOnlineStatus } from '../../services/OnlineStatusManager';

const TIMEOUT_DURATION = 30000; // Increased to 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export const useAuthHandlers = (setError: (error: string | null) => void, setLoading: (loading: boolean) => void) => {
    const { safeNavigate } = useNavigation();

    const handleError = (error: any, defaultMessage: string = 'An error occurred') => {
        console.error('Auth error:', error);
        setError(error?.message || defaultMessage);
        setLoading(false);
    };

    const clearError = () => {
        setError(null);
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const checkConnection = async () => {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                throw new Error('No internet connection. Please check your network settings.');
            }

            // Check Supabase connection by making a lightweight auth call
            const { data, error } = await supabase.auth.getSession();
            if (error && !error.message.includes('Invalid session')) {
                // We only throw if it's not an invalid session error, as that's expected when not logged in
                throw new Error('Unable to reach authentication server.');
            }

            return true;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unable to connect to authentication server. Please try again.');
        }
    };

    const signInWithRetry = async (email: string, password: string, retryCount = 0): Promise<any> => {
        try {
            // Add a small delay between retries
            if (retryCount > 0) {
                await delay(RETRY_DELAY * retryCount);
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('Sign in attempt failed:', error);
                if (retryCount < MAX_RETRIES &&
                    (error.message.includes('timeout') ||
                        error.message.includes('network') ||
                        error.message.includes('connection'))) {
                    console.log(`Retrying sign in (${retryCount + 1}/${MAX_RETRIES})...`);
                    return signInWithRetry(email, password, retryCount + 1);
                }
                throw error;
            }

            return data;
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                console.log(`Retrying sign in (${retryCount + 1}/${MAX_RETRIES})...`);
                return signInWithRetry(email, password, retryCount + 1);
            }
            throw error;
        }
    };

    const signIn = async (email: string, password: string) => {
        console.log('Starting sign in process for:', email);
        setLoading(true);
        clearError();

        try {
            // Dismiss keyboard if it's open
            if (Platform.OS !== 'web') {
                Keyboard.dismiss();
            }

            // Check connection first
            await checkConnection();

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Sign in process timed out. Please try again.')), TIMEOUT_DURATION);
            });

            // Create the sign in promise with retry logic
            const signInPromise = signInWithRetry(email, password);

            // Race between timeout and sign in
            const data = await Promise.race([
                signInPromise,
                timeoutPromise
            ]);

            if (!data?.session) {
                throw new Error('No session returned after sign in');
            }

            console.log('Sign in successful, fetching user data');
            const userData = await fetchUserData(data.session.user.id);

            if (!userData) {
                throw new Error('Failed to fetch user data after sign in');
            }

            // Initialize online status manager
            try {
                console.log('Initializing online status for user:', data.session.user.id);
                await initializeOnlineStatus(data.session.user.id);
                console.log('Online status initialized successfully');
            } catch (onlineError) {
                console.error('Failed to initialize online status:', onlineError);
                // Don't fail the login if online status fails
            }

            // Note: Navigation is handled automatically by App.tsx Navigation component
            // based on userData state. No manual navigation needed here.
            console.log('Sign in: Profile completion check:', {
                role: userData.role,
                profile_completed: userData.profile_completed,
                profileCompleted: userData.profile_completed === true || userData.profile_completed === 'true',
                isAdmin: userData.role === 'admin'
            });

            return data;
        } catch (error: any) {
            console.error('Sign in process failed:', error);
            let errorMessage = 'Sign in failed. ';
            if (error.message.includes('timeout')) {
                errorMessage += 'The request timed out. Please check your internet connection and try again.';
            } else if (error.message.includes('Invalid login')) {
                errorMessage += 'Invalid email or password.';
            } else if (error.message.includes('network')) {
                errorMessage += 'Network error. Please check your internet connection.';
            } else {
                errorMessage += error.message;
            }
            handleError(error, errorMessage);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchUserData = async (userId: string) => {
        console.log('fetchUserData: Starting fetch for userId:', userId);
        try {
            // Get the user's profile data - explicitly select key columns including JSONB fields
            console.log('fetchUserData: Querying Supabase users table');
            const { data: userData, error: dbError } = await supabase
                .from('users')
                .select('id, email, name, role, profile_completed, driver_type, profile_image, phone_number, address, bank_info, company_info, taxi_permit_number, license_type, skills, experience, created_at, updated_at')
                .eq('id', userId)
                .single();

            if (dbError) {
                console.error('fetchUserData: Supabase error:', dbError);
                throw dbError;
            }

            if (!userData) {
                console.error('fetchUserData: No user data found');
                return null;
            }

            console.log('fetchUserData: Successfully fetched user data:', {
                id: userData.id,
                email: userData.email,
                role: userData.role,
                profile_completed: userData.profile_completed,
                profile_completed_type: typeof userData.profile_completed,
                profile_completed_value: userData.profile_completed,
                hasRole: !!userData.role,
                hasProfileCompleted: userData.profile_completed !== undefined,
                isProfileCompleted: userData.profile_completed === true,
                hasAddress: !!userData.address,
                addressType: typeof userData.address,
                addressValue: userData.address ? JSON.stringify(userData.address).substring(0, 200) : 'null',
                hasProfileImage: !!userData.profile_image,
                profileImageValue: userData.profile_image ? userData.profile_image.substring(0, 100) : 'null',
                profileImageType: typeof userData.profile_image,
                rawData: JSON.stringify(userData).substring(0, 300)
            });
            
            // Ensure profile_completed is explicitly set (handle null/undefined)
            if (userData.profile_completed === null || userData.profile_completed === undefined) {
                console.warn('⚠️ fetchUserData: profile_completed is null/undefined, defaulting to false');
                userData.profile_completed = false;
            }
            
            // Map database fields (snake_case) to frontend fields (camelCase)
            const mappedUserData = {
                ...userData,
                // Map profile_image to profileImage - ensure it's a valid URL string
                profileImage: userData.profile_image && typeof userData.profile_image === 'string' 
                    ? userData.profile_image.trim() 
                    : (userData.profile_image || null),
                phoneNumber: userData.phone_number || null,
                // Map professional fields (snake_case to camelCase)
                taxiPermitNumber: userData.taxi_permit_number || null,
                licenseType: userData.license_type || null,
                skills: userData.skills || null,
                experience: userData.experience || null,
                // Map bank_info (snake_case JSONB) to bankInfo (camelCase)
                bankInfo: userData.bank_info ? {
                    accountName: userData.bank_info.account_name || null,
                    accountNumber: userData.bank_info.account_number || null,
                    bankName: userData.bank_info.bank_name || null,
                    swiftCode: userData.bank_info.swift_code || null,
                } : null,
                // Map company_info (snake_case JSONB) to companyInfo (camelCase)
                companyInfo: userData.company_info ? {
                    companyName: userData.company_info.company_name || null,
                    taxId: userData.company_info.tax_id || null,
                    carPlateNumber: userData.company_info.car_plate_number || null,
                } : null,
            // Map address (snake_case JSONB) to address (camelCase keys)
            // Handle both JSONB object and potential string format
            address: userData.address ? (() => {
                // If address is a string, try to parse it
                if (typeof userData.address === 'string') {
                    try {
                        const parsed = JSON.parse(userData.address);
                        return {
                            street: parsed.street || parsed.street_address || null,
                            city: parsed.city || null,
                            state: parsed.state || null,
                            postalCode: parsed.postal_code || parsed.postalCode || parsed.zip || null,
                            country: parsed.country || null,
                        };
                    } catch (e) {
                        console.warn('Failed to parse address string:', e);
                        return null;
                    }
                }
                // If address is already an object (JSONB)
                return {
                    street: userData.address.street || userData.address.street_address || null,
                    city: userData.address.city || null,
                    state: userData.address.state || null,
                    postalCode: userData.address.postal_code || userData.address.postalCode || null,
                    country: userData.address.country || null,
                };
            })() : null,
            };
            
            return mappedUserData;
        } catch (error) {
            console.error('fetchUserData: Error in fetch:', error);
            return null;
        }
    };

    const signOut = async () => {
        console.log('Starting sign out process');
        setLoading(true);
        clearError();

        try {
            // Dismiss keyboard if it's open
            if (Platform.OS !== 'web') {
                Keyboard.dismiss();
            }

            // Cleanup online status before signing out
            try {
                console.log('Cleaning up online status');
                await cleanupOnlineStatus();
                console.log('Online status cleaned up successfully');
            } catch (onlineError) {
                console.error('Failed to cleanup online status:', onlineError);
                // Don't fail the logout if online status cleanup fails
            }

            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            // Clear any stored auth state
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('userData');

            // Add a small delay to ensure state is cleared
            await delay(100);

            // Navigate to Welcome screen
            safeNavigate('Welcome');
        } catch (error: any) {
            console.error('Sign out process failed:', error);
            handleError(error, 'Failed to sign out. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        handleError,
        clearError,
        fetchUserData,
        signIn,
        signOut
    };
}; 