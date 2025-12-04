import { supabase } from '../config/supabase';
import { Platform } from 'react-native';
import { AppState } from 'react-native';

/**
 * Simple function to update user online status
 */
export const updateOnlineStatus = async (userId: string, isOnline: boolean = true) => {
    try {
        console.log(`Updating online status for user ${userId}: ${isOnline}`);

        // Update users table directly (only is_online and updated_at)
        const { error: usersError } = await supabase
            .from('users')
            .update({
                is_online: isOnline,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (usersError) {
            console.error('Error updating users table:', usersError);
        }

        // Update user_status table
        const { error: statusError } = await supabase
            .from('user_status')
            .upsert({
                user_id: userId,
                is_online: isOnline,
                platform: Platform.OS,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (statusError) {
            console.error('Error updating user_status table:', statusError);
        }

        console.log(`✅ Successfully updated online status for user ${userId}`);
    } catch (error) {
        console.error('Error in updateOnlineStatus:', error);
    }
};

/**
 * Simple function to get user online status
 */
export const getOnlineStatus = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('is_online')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting online status:', error);
        return null;
    }
};

/**
 * Simple online status tracking
 */
export const startSimpleOnlineTracking = (userId: string) => {
    console.log(`Starting simple online tracking for user ${userId}`);

    let heartbeatInterval: NodeJS.Timeout | null = null;
    let isTracking = true;

    const updateStatus = async (online: boolean) => {
        if (!isTracking) return;
        await updateOnlineStatus(userId, online);
    };

    const startHeartbeat = () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
                updateStatus(true);
            }
        }, 30000); // Update every 30 seconds
    };

    const handleAppStateChange = (nextAppState: string) => {
        const isOnline = nextAppState === 'active';
        updateStatus(isOnline);

        if (isOnline) {
            startHeartbeat();
        } else if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    };

    // Set initial online status
    updateStatus(true);
    startHeartbeat();

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Return cleanup function
    return () => {
        console.log(`Stopping online tracking for user ${userId}`);
        isTracking = false;
        subscription.remove();
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        updateStatus(false);
    };
};

/**
 * Force set user as online (for testing)
 */
export const forceSetOnline = async (userId: string) => {
    try {
        console.log(`Force setting user ${userId} as online`);

        // Update both tables
        await Promise.all([
            supabase
                .from('users')
                .update({
                    is_online: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId),

            supabase
                .from('user_status')
                .upsert({
                    user_id: userId,
                    is_online: true,
                    platform: Platform.OS,
                    last_seen: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })
        ]);

        console.log(`✅ Force set user ${userId} as online`);
    } catch (error) {
        console.error('Error force setting online:', error);
    }
}; 