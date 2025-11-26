import { supabase, checkAuthState } from '../config/supabase';
import { Platform } from 'react-native';
import { AppState } from 'react-native';
import { UUID } from 'crypto';

export const updateOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
        console.log(`🔄 updateOnlineStatus: Starting update for user ${userId}, setting online: ${isOnline}`);

        // Check auth state and ensure valid token
        const session = await checkAuthState();
        if (!session?.user) {
            console.warn('updateOnlineStatus: No valid session found, skipping presence update');
            return;
        }

        // Verify the user is updating their own status
        if (session.user.id !== userId) {
            console.warn(`updateOnlineStatus: User ID mismatch (session: ${session.user.id}, requested: ${userId}) - skipping`);
            return;
        }

        console.log(`✅ updateOnlineStatus: Auth verified for user ${userId}`);

        // Try RPC function with p_is_online first
        const { error: rpcError } = await supabase
            .rpc('upsert_user_status', {
                p_is_online: isOnline,
                p_platform: Platform.OS,
                p_platform_version: Platform.Version.toString()
            });

        if (rpcError) {
            console.warn('⚠️ updateOnlineStatus: RPC update with p_is_online failed, trying with p_online:', rpcError);

            // Try with p_online parameter if p_is_online failed
            const { error: rpcError2 } = await supabase
                .rpc('upsert_user_status_compat', {
                    p_online: isOnline,
                    p_platform: Platform.OS,
                    p_platform_version: Platform.Version.toString()
                });

            if (rpcError2) {
                console.warn('⚠️ updateOnlineStatus: RPC update with p_online also failed, trying direct upsert:', rpcError2);

                // Fallback to direct upsert if RPC fails
                const { error: directError } = await supabase
                    .from('user_status')
                    .upsert({
                        user_id: session.user.id,
                        is_online: isOnline,
                        platform: Platform.OS,
                        last_seen: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id'
                    });

                if (directError) {
                    throw directError;
                }
            }
        }

        console.log(`✅ Successfully updated online status for user: ${session.user.id} (online: ${isOnline})`);
    } catch (error) {
        console.error('❌ Error in updateOnlineStatus:', error);
    }
};

export const getOnlineStatus = async (userId: string) => {
    try {
        const session = await checkAuthState();
        if (!session?.user) {
            console.warn('No valid session found');
            return null;
        }

        const { data, error } = await supabase
            .from('user_status')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting online status:', error);
        throw error;
    }
};

export const subscribeToOnlineStatus = (userId: string, callback: (isOnline: boolean) => void) => {
    const subscription = supabase
        .channel(`user_status:${userId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_status',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            callback(payload.new.is_online);
        })
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
};

export const startOnlineStatusTracking = (userId: string) => {
    console.log(`🚀 startOnlineStatusTracking: Starting for user ${userId}`);

    let heartbeatInterval: NodeJS.Timeout | null = null;
    let lastUpdateTime = Date.now();

    const updatePresence = async (isOnline: boolean) => {
        const now = Date.now();
        if (now - lastUpdateTime < 5000) return;

        lastUpdateTime = now;
        try {
            console.log(`📡 updatePresence: Updating presence for user ${userId}, online: ${isOnline}`);
            await updateOnlineStatus(userId, isOnline);
        } catch (error) {
            console.error('❌ Error updating presence:', error);
        }
    };

    const startHeartbeat = () => {
        console.log(`💓 startHeartbeat: Starting heartbeat for user ${userId}`);
        heartbeatInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
                updatePresence(true);
            }
        }, 30000);
    };

    const handleAppStateChange = (nextAppState: string) => {
        const isOnline = nextAppState === 'active';
        console.log(`📱 handleAppStateChange: App state changed to ${nextAppState} for user ${userId}`);
        updatePresence(isOnline);

        if (isOnline) {
            startHeartbeat();
        } else if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    };

    // Set initial online status
    console.log(`🎯 startOnlineStatusTracking: Setting initial online status for user ${userId}`);
    updatePresence(true);
    startHeartbeat();

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Create cleanup function
    const cleanup = () => {
        console.log(`🧹 startOnlineStatusTracking: Cleaning up for user ${userId}`);
        subscription.remove();
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        updatePresence(false).catch(console.error);
    };

    // Store cleanup function globally
    window.presenceCleanup = cleanup;

    return cleanup;
}; 
