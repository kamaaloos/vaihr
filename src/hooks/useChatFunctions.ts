import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import Toast from 'react-native-toast-message';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useChatFunctions = (adminId: string, initialChatId?: string) => {
    const { createOrGetChat, sendMessage, deleteMessage, messages, setMessages, loading, error: chatError } = useChat();
    const { user } = useAuth();
    const [text, setText] = useState('');
    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const isMounted = useRef(true);
    const [currentChatId, setCurrentChatId] = useState<string | undefined>(initialChatId);
    const initAttempted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const initializeChat = useCallback(async () => {
        if (!adminId || !user || initAttempted.current) {
            return;
        }

        try {
            console.log('initializeChat: Starting chat initialization', { adminId, initialChatId });
            initAttempted.current = true;

            // Create or get chat
            const result = await createOrGetChat(adminId);

            if (result.error) {
                console.error('initializeChat: Error creating/getting chat:', result.error);
                throw result.error;
            }

            if (!result.data) {
                console.error('initializeChat: No chat data returned');
                throw new Error('Failed to create or get chat - no data returned');
            }

            console.log('initializeChat: Successfully initialized chat:', result.data.id);
            if (isMounted.current) {
                setCurrentChatId(result.data.id);
            }
        } catch (error) {
            console.error('initializeChat: Error initializing chat:', error);
            if (isMounted.current) {
                setInitError(error instanceof Error ? error.message : 'Failed to initialize chat');
            }
        } finally {
            if (isMounted.current) {
                setIsInitializing(false);
            }
        }
    }, [adminId, user]); // Remove createOrGetChat dependency

    useEffect(() => {
        // Only initialize if we have the required parameters and haven't attempted yet
        if (adminId && user && !initAttempted.current) {
            initializeChat();
        }
    }, [adminId, user]); // Only depend on adminId and user, not initializeChat

    // Handle chat context errors
    useEffect(() => {
        if (chatError && isMounted.current) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: chatError,
            });
        }
    }, [chatError]);

    const handleSend = useCallback(async () => {
        if (!text.trim()) {
            return;
        }

        try {
            await sendMessage(text.trim());
            setText('');
        } catch (error) {
            console.error('Error sending message:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to send message',
            });
        }
    }, [text, sendMessage]);

    const handleDelete = useCallback(async (messageId: string) => {
        try {
            await deleteMessage(messageId);
        } catch (error) {
            console.error('Error deleting message:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete message',
            });
        }
    }, [deleteMessage]);

    const retryInitialization = useCallback(() => {
        setInitError(null);
        setIsInitializing(true);
        initAttempted.current = false;
        initializeChat();
    }, [initializeChat]);

    const returnValue = useMemo(() => ({
        text,
        setText,
        messages,
        setMessages,
        handleDelete,
        isInitializing,
        initError,
        isLoading: loading,
        retryInitialization,
        chatId: currentChatId
    }), [
        text,
        setText,
        messages,
        setMessages,
        handleDelete,
        isInitializing,
        initError,
        loading,
        retryInitialization,
        currentChatId
    ]);

    return returnValue;
}; 