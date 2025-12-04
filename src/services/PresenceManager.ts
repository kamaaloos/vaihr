import { supabase } from '../config/supabase';

export interface PresenceData {
    user_id: string;
    online_at: string;
    role?: string;
    isTyping?: boolean;
    last_seen?: string;
    online?: boolean;
}

export class PresenceManager {
    private static instance: PresenceManager | null = null;
    private globalChannel: any = null;
    private chatChannels: Map<string, any> = new Map();
    private userId: string | null = null;
    private isInitialized = false;

    private constructor() { }

    static getInstance(): PresenceManager {
        if (!PresenceManager.instance) {
            PresenceManager.instance = new PresenceManager();
        }
        return PresenceManager.instance;
    }

    async initialize(userId: string) {
        if (this.isInitialized && this.userId === userId) {
            console.log('PresenceManager: Already initialized for user:', userId);
            return;
        }

        console.log('PresenceManager: Initializing for user:', userId);
        this.userId = userId;

        // Clean up existing channels
        await this.cleanup();

        // Initialize global presence channel
        await this.initializeGlobalChannel();

        this.isInitialized = true;
        console.log('PresenceManager: Initialized successfully');
    }

    private async initializeGlobalChannel() {
        if (!this.userId) return;

        console.log('PresenceManager: Initializing global presence channel');

        this.globalChannel = supabase.channel('global_presence', {
            config: {
                broadcast: { self: true }
            }
        })
            .on('presence', { event: 'sync' }, () => {
                const state = this.globalChannel.presenceState();
                console.log('PresenceManager: Global presence sync:', {
                    keys: Object.keys(state),
                    totalUsers: Object.keys(state).length
                });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('PresenceManager: User joined global presence:', {
                    key,
                    newPresences: newPresences.length
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('PresenceManager: User left global presence:', {
                    key,
                    leftPresences: leftPresences.length
                });
            })
            .subscribe(async (status) => {
                console.log('PresenceManager: Global channel status:', status);

                if (status === 'SUBSCRIBED') {
                    // Get user role
                    const { data: userData } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', this.userId)
                        .single();

                    // Track presence in global channel
                    await this.globalChannel.track({
                        user_id: this.userId,
                        online_at: new Date().toISOString(),
                        role: userData?.role || 'user',
                        online: true
                    });

                    console.log('PresenceManager: Tracking presence in global channel');
                }
            });
    }

    async joinChatPresence(chatId: string) {
        if (!this.userId || !chatId) return;

        // Don't create duplicate channels
        if (this.chatChannels.has(chatId)) {
            console.log('PresenceManager: Already in chat presence:', chatId);
            return;
        }

        console.log('PresenceManager: Joining chat presence:', chatId);

        const chatChannel = supabase.channel(`presence:${chatId}`, {
            config: {
                presence: {
                    key: this.userId,
                },
                broadcast: { self: true }
            }
        })
            .on('presence', { event: 'sync' }, () => {
                const state = chatChannel.presenceState();
                console.log('PresenceManager: Chat presence sync:', {
                    chatId,
                    keys: Object.keys(state),
                    totalUsers: Object.keys(state).length
                });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('PresenceManager: User joined chat presence:', {
                    chatId,
                    key,
                    newPresences: newPresences.length
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('PresenceManager: User left chat presence:', {
                    chatId,
                    key,
                    leftPresences: leftPresences.length
                });
            })
            .subscribe(async (status) => {
                console.log('PresenceManager: Chat channel status:', { chatId, status });

                if (status === 'SUBSCRIBED') {
                    // Get user role
                    const { data: userData } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', this.userId)
                        .single();

                    // Track presence in chat channel
                    await chatChannel.track({
                        user_id: this.userId,
                        online_at: new Date().toISOString(),
                        role: userData?.role || 'user',
                        online: true,
                        isTyping: false
                    });

                    console.log('PresenceManager: Tracking presence in chat channel:', chatId);
                }
            });

        this.chatChannels.set(chatId, chatChannel);
    }

    async leaveChatPresence(chatId: string) {
        const channel = this.chatChannels.get(chatId);
        if (channel) {
            console.log('PresenceManager: Leaving chat presence:', chatId);
            channel.unsubscribe();
            this.chatChannels.delete(chatId);
        }
    }

    async updateTypingStatus(chatId: string, isTyping: boolean) {
        if (!this.userId || !chatId) {
            console.log('PresenceManager: Cannot update typing status - missing userId or chatId:', {
                userId: this.userId,
                chatId
            });
            return;
        }

        const channel = this.chatChannels.get(chatId);
        if (channel) {
            console.log('PresenceManager: Updating typing status:', { chatId, isTyping, userId: this.userId });

            try {
                await channel.track({
                    user_id: this.userId,
                    online_at: new Date().toISOString(),
                    online: true,
                    isTyping
                });
                console.log('PresenceManager: Typing status tracked successfully');
            } catch (error) {
                console.error('PresenceManager: Error tracking typing status:', error);
            }
        } else {
            console.log('PresenceManager: No channel found for chatId:', chatId);
        }
    }

    getGlobalPresenceState() {
        if (!this.globalChannel) return {};
        return this.globalChannel.presenceState();
    }

    getChatPresenceState(chatId: string) {
        const channel = this.chatChannels.get(chatId);
        if (!channel) {
            console.log('PresenceManager: No channel found for getChatPresenceState:', chatId);
            return {};
        }

        const state = channel.presenceState();
        console.log('PresenceManager: Raw presence state for chatId:', chatId, 'state:', state);
        return state;
    }

    async cleanup() {
        console.log('PresenceManager: Cleaning up');

        // Clean up global channel
        if (this.globalChannel) {
            this.globalChannel.unsubscribe();
            this.globalChannel = null;
        }

        // Clean up chat channels
        for (const [chatId, channel] of this.chatChannels) {
            console.log('PresenceManager: Cleaning up chat channel:', chatId);
            channel.unsubscribe();
        }
        this.chatChannels.clear();

        this.isInitialized = false;
        console.log('PresenceManager: Cleanup complete');
    }
}

// Global instance for easy access
export const getPresenceManager = () => PresenceManager.getInstance(); 