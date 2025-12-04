import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export const usePresenceNotifications = () => {
    const { user } = useAuth();
    const activeChannels = useRef<Record<string, any>>({});

    useEffect(() => {
        if (!user) return;

        console.log('Setting up presence notifications for user:', user.id);

        // Subscribe to presence notifications
        const subscription = supabase
            .channel('presence_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'presence_notifications',
                filter: `user_id=eq.${user.id}`
            }, async (payload) => {
                console.log('Received presence notification:', payload);
                const { chat_id } = payload.new;

                // If we already have a channel for this chat, don't create a new one
                if (activeChannels.current[chat_id]) {
                    console.log('Channel already exists for chat:', chat_id);
                    return;
                }

                console.log('Creating new presence channel for chat:', chat_id);
                // Join the presence channel for this chat
                const channel = supabase.channel(`presence:${chat_id}`);
                activeChannels.current[chat_id] = channel;

                try {
                    await channel
                        .on('presence', { event: 'sync' }, () => {
                            const state = channel.presenceState();
                            console.log('Chat presence sync state:', state);
                        })
                        .subscribe(async (status) => {
                            console.log('Chat presence channel status:', status);
                            if (status === 'SUBSCRIBED') {
                                // Track user's presence in this channel
                                const presenceData = {
                                    user_id: user.id,
                                    isTyping: false,
                                    last_seen: new Date().toISOString(),
                                    online: true
                                };
                                console.log('Tracking presence in chat:', presenceData);
                                await channel.track(presenceData);
                            }
                        });
                } catch (error) {
                    console.error('Error setting up presence channel:', error);
                }
            })
            .subscribe((status) => {
                console.log('Presence notifications subscription status:', status);
            });

        // Cleanup function
        return () => {
            console.log('Cleaning up presence notifications');
            subscription.unsubscribe();
            // Unsubscribe from all active channels
            Object.entries(activeChannels.current).forEach(([chatId, channel]) => {
                console.log('Unsubscribing from chat:', chatId);
                channel.unsubscribe();
            });
            activeChannels.current = {};
        };
    }, [user]);
}; 