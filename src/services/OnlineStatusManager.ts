import { supabase } from '../config/supabase';
import { getPresenceManager } from './PresenceManager';

export class OnlineStatusManager {
    private userId: string;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private subscription: any = null;
    private isInitialized = false;

    constructor(userId: string) {
        this.userId = userId;
    }

    /**
     * Initialize the online status manager
     * Sets user online, starts heartbeat, and subscribes to changes
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('OnlineStatusManager: Already initialized');
            return;
        }

        try {
            console.log(`🎯 OnlineStatusManager: INITIALIZING FOR USER ${this.userId} - THIS SHOULD APPEAR FOR ADMIN LOGIN`);
            console.log('OnlineStatusManager: Initializing for user:', this.userId);

            // Initialize presence manager
            await getPresenceManager().initialize(this.userId);

            // Set user online with retry logic
            await this.setOnlineWithRetry();

            // Start heartbeat
            this.startHeartbeat();

            // Subscribe to changes
            this.subscribeToChanges();

            this.isInitialized = true;
            console.log('OnlineStatusManager: Initialized successfully');
        } catch (error) {
            console.error('OnlineStatusManager: Failed to initialize:', error);
            // Don't throw error, just log it and continue
            // This prevents login from failing if online status fails
            console.log('OnlineStatusManager: Continuing without online status initialization');
        }
    }

    /**
     * Set user online with retry logic
     */
    private async setOnlineWithRetry(retryCount = 0): Promise<void> {
        const maxRetries = 3;

        try {
            await this.setOnline();
        } catch (error: any) {
            console.error(`OnlineStatusManager: Set online attempt ${retryCount + 1} failed:`, error);

            if (retryCount < maxRetries) {
                console.log(`OnlineStatusManager: Retrying set online (${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
                return this.setOnlineWithRetry(retryCount + 1);
            } else {
                console.error('OnlineStatusManager: Max retries reached, giving up on set online');
                throw error;
            }
        }
    }

    /**
     * Set user as online
     */
    async setOnline() {
        try {
            console.log(`🔄 OnlineStatusManager: Starting update for user ${this.userId}, setting online: true`);

            // First, try to update existing record
            const { data: existingRecord, error: selectError } = await supabase
                .from('user_status')
                .select('user_id, is_online')
                .eq('user_id', this.userId)
                .single();

            console.log('OnlineStatusManager: Existing record check result:', { existingRecord, selectError });

            if (selectError && selectError.code !== 'PGRST116') {
                // PGRST116 is "not found" error, which is expected if record doesn't exist
                console.error('OnlineStatusManager: Error checking existing record:', selectError);
            }

            let result;
            if (existingRecord) {
                // Record exists, update it
                console.log('OnlineStatusManager: Updating existing user_status record');
                result = await supabase
                    .from('user_status')
                    .update({
                        is_online: true,
                        platform: 'mobile',
                        last_seen: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', this.userId)
                    .select(); // Add select to see the result
            } else {
                // Record doesn't exist, insert new one
                console.log('OnlineStatusManager: Creating new user_status record');
                result = await supabase
                    .from('user_status')
                    .insert({
                        user_id: this.userId,
                        is_online: true,
                        platform: 'mobile',
                        last_seen: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select(); // Add select to see the result
            }

            console.log('OnlineStatusManager: Database operation result:', result);

            if (result.error) {
                console.error('OnlineStatusManager: Failed to set online:', result.error);
                throw result.error;
            }

            // Add a small delay to allow database triggers to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify the update worked with retry logic
            let verifyData = null;
            let verifyError = null;
            let verificationAttempts = 0;
            const maxVerificationAttempts = 3;

            while (verificationAttempts < maxVerificationAttempts) {
                try {
                    const { data, error } = await supabase
                        .from('user_status')
                        .select('is_online')
                        .eq('user_id', this.userId)
                        .single();

                    verifyData = data;
                    verifyError = error;

                    console.log(`OnlineStatusManager: Verification attempt ${verificationAttempts + 1} result:`, { verifyData, verifyError });

                    if (verifyData && verifyData.is_online) {
                        console.log(`✅ Successfully updated online status for user: ${this.userId} (online: true)`);
                        break; // Success, exit the loop
                    } else if (verificationAttempts < maxVerificationAttempts - 1) {
                        console.log(`OnlineStatusManager: Verification failed, retrying in 1 second... (attempt ${verificationAttempts + 1}/${maxVerificationAttempts})`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error(`OnlineStatusManager: Verification attempt ${verificationAttempts + 1} error:`, error);
                    if (verificationAttempts < maxVerificationAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                verificationAttempts++;
            }

            if (!verifyData || !verifyData.is_online) {
                console.error('OnlineStatusManager: User was not set to online properly after all verification attempts');
                throw new Error('Failed to set user online - verification failed after multiple attempts');
            }
        } catch (error) {
            console.error('OnlineStatusManager: Error setting online:', error);
            throw error;
        }
    }

    /**
     * Set user as offline
     */
    async setOffline() {
        try {
            console.log(`🔄 OnlineStatusManager: Starting update for user ${this.userId}, setting online: false`);

            const { error } = await supabase
                .from('user_status')
                .update({
                    is_online: false,
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', this.userId);

            if (error) {
                console.error('OnlineStatusManager: Failed to set offline:', error);
                throw error;
            }

            console.log(`✅ Successfully updated online status for user: ${this.userId} (online: false)`);
        } catch (error) {
            console.error('OnlineStatusManager: Error setting offline:', error);
            throw error;
        }
    }

    /**
     * Start heartbeat to keep user marked as online
     */
    private startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.updateLastSeen();
            } catch (error) {
                console.error('OnlineStatusManager: Heartbeat failed:', error);
            }
        }, 30000); // Update every 30 seconds

        console.log('OnlineStatusManager: Heartbeat started');
    }

    /**
     * Update last seen timestamp
     */
    private async updateLastSeen() {
        try {
            const { error } = await supabase
                .from('user_status')
                .update({
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', this.userId);

            if (error) {
                console.error('OnlineStatusManager: Failed to update last seen:', error);
                throw error;
            }
        } catch (error) {
            console.error('OnlineStatusManager: Error updating last seen:', error);
            throw error;
        }
    }

    /**
     * Subscribe to real-time changes in user_status
     */
    private subscribeToChanges() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }

        this.subscription = supabase
            .channel('online_status')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_status',
                    filter: `user_id=eq.${this.userId}`
                },
                (payload) => {
                    console.log('OnlineStatusManager: Status changed:', payload);
                    // You can add custom logic here to handle status changes
                }
            )
            .subscribe();

        console.log('OnlineStatusManager: Real-time subscription started');
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        console.log('OnlineStatusManager: Cleaning up');

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        // Clean up presence manager
        await getPresenceManager().cleanup();

        this.isInitialized = false;
        console.log('OnlineStatusManager: Cleanup complete');
    }

    /**
     * Get current online status
     */
    async getOnlineStatus() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('online, user_status(last_seen, platform)')
                .eq('id', this.userId)
                .single();

            if (error) {
                console.error('OnlineStatusManager: Failed to get status:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('OnlineStatusManager: Error getting status:', error);
            return null;
        }
    }

    /**
     * Get all online users
     */
    static async getOnlineUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
          id,
          name,
          email,
          role,
          online,
          user_status (
            platform,
            last_seen
          )
        `)
                .eq('online', true)
                .order('user_status.last_seen', { ascending: false });

            if (error) {
                console.error('OnlineStatusManager: Failed to get online users:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('OnlineStatusManager: Error getting online users:', error);
            return [];
        }
    }
}

// Global instance for easy access
let globalOnlineManager: OnlineStatusManager | null = null;

/**
 * Initialize global online status manager
 */
export const initializeOnlineStatus = async (userId: string) => {
    console.log(`🚀 initializeOnlineStatus: CALLED FOR USER ${userId} - THIS SHOULD APPEAR FOR ADMIN LOGIN`);

    if (globalOnlineManager) {
        globalOnlineManager.cleanup();
    }

    globalOnlineManager = new OnlineStatusManager(userId);
    await globalOnlineManager.initialize();

    return globalOnlineManager;
};

/**
 * Cleanup global online status manager
 */
export const cleanupOnlineStatus = async () => {
    if (globalOnlineManager) {
        await globalOnlineManager.setOffline();
        await globalOnlineManager.cleanup();
        globalOnlineManager = null;
    }
};

/**
 * Get global online status manager
 */
export const getOnlineStatusManager = () => {
    return globalOnlineManager;
}; 