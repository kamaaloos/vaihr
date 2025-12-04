import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Message } from '../types';

interface Message {
    id: string;
    chat_id: string;
    sender_id: string;
    local_id?: string;
    text: string;
    image_url?: string;
    created_at: string;
    updated_at: string;
    read: boolean;
    delivered: boolean;
    deleted: boolean;
    read_at?: string;
    edited_at?: string;
    deleted_at?: string;
    delivered_at?: string;
}

interface Chat {
    id: string;
    job_id: string;
    driver_id: string;
    admin_id: string;
    created_at: string;
    updated_at: string;
}

export const useChat = (chatId?: string) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch messages
    useEffect(() => {
        if (!chatId || !user) return;

        const fetchMessages = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
                        id,
                        text,
                        sender_id,
                        created_at,
                        updated_at,
                        read,
                        edited,
                        deleted,
                        delivered,
                        image_url,
                        read_at,
                        edited_at,
                        deleted_at,
                        delivered_at,
                        sender:sender_id (
                            id,
                            full_name,
                            avatar_url
                        )
                    `)
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (error) throw error;
                setMessages(data || []);
                setHasMore(data?.length === 50);

                // Mark messages as read
                const unreadMessages = data?.filter(
                    msg => msg.sender_id !== user.id && !msg.read
                ) || [];

                setUnreadCount(unreadMessages.length);

                if (unreadMessages.length > 0) {
                    await supabase
                        .from('messages')
                        .update({
                            read: true,
                            read_at: new Date().toISOString()
                        })
                        .in('id', unreadMessages.map(msg => msg.id));
                }
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to new messages
        const messageSubscription = supabase
            .channel(`chat:${chatId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMessage = payload.new as Message;
                    setMessages(current => [...current, newMessage]);

                    // Mark as read if from other user
                    if (newMessage.sender_id !== user.id) {
                        await supabase
                            .from('messages')
                            .update({
                                read: true,
                                read_at: new Date().toISOString(),
                                delivered: true,
                                delivered_at: new Date().toISOString()
                            })
                            .eq('id', newMessage.id);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(current =>
                        current.map(msg =>
                            msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
                        )
                    );
                } else if (payload.eventType === 'DELETE') {
                    setMessages(current =>
                        current.filter(msg => msg.id !== payload.old.id)
                    );
                }
            })
            .subscribe();

        // Subscribe to typing status
        const typingSubscription = supabase
            .channel(`typing:${chatId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'typing_status',
                filter: `chat_id=eq.${chatId} and user_id=neq.${user.id}`
            }, (payload) => {
                setIsTyping(payload.new.is_typing);
            })
            .subscribe();

        return () => {
            messageSubscription.unsubscribe();
            typingSubscription.unsubscribe();
        };
    }, [chatId, user]);

    // Send message
    const sendMessage = useCallback(async (text: string, imageUrl?: string) => {
        if (!chatId || !user) throw new Error('Cannot send message: chat not initialized');

        try {
            const localId = Math.random().toString(36).substr(2, 9);

            const { data, error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chatId,
                    sender_id: user.id,
                    local_id: localId,
                    text,
                    image_url: imageUrl,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return data;
        } catch (err) {
            console.error('Error sending message:', err);
            throw err;
        }
    }, [chatId, user]);

    // Delete message
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!user) throw new Error('Cannot delete message: user not authenticated');

        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    deleted: true,
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', messageId)
                .eq('sender_id', user.id);

            if (error) throw error;
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    }, [user]);

    // Set typing status
    const setTypingStatus = useCallback(async (isTyping: boolean) => {
        if (!chatId || !user) return;

        try {
            await supabase
                .from('typing_status')
                .upsert({
                    chat_id: chatId,
                    user_id: user.id,
                    is_typing: isTyping,
                    updated_at: new Date().toISOString()
                });
        } catch (err) {
            console.error('Error updating typing status:', err);
        }
    }, [chatId, user]);

    // Load more messages
    const loadMore = useCallback(async () => {
        if (!chatId || !user || loading || !hasMore) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    text,
                    sender_id,
                    created_at,
                    updated_at,
                    read,
                    edited,
                    deleted,
                    delivered,
                    image_url,
                    read_at,
                    edited_at,
                    deleted_at,
                    delivered_at,
                    sender:sender_id (
                        id,
                        full_name,
                        avatar_url
                    )
                `)
                .eq('chat_id', chatId)
                .order('created_at', { ascending: false })
                .range(messages.length, messages.length + 49);

            if (error) throw error;

            if (data) {
                setMessages(prev => [...prev, ...data.reverse()]);
                setHasMore(data.length === 50);
            }
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [chatId, user, loading, hasMore, messages.length]);

    const createChat = async (jobId: string, driverId: string, adminId: string): Promise<string> => {
        try {
            const { data, error } = await supabase
                .from('chats')
                .insert([
                    {
                        job_id: jobId,
                        driver_id: driverId,
                        admin_id: adminId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (err) {
            console.error('Error creating chat:', err);
            throw err;
        }
    };

    return {
        messages,
        loading,
        error,
        hasMore,
        isTyping,
        unreadCount,
        sendMessage,
        deleteMessage,
        setTypingStatus,
        loadMore,
        createChat
    };
}; 