import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getPresenceManager, PresenceData } from '../services/PresenceManager';
import { useAuth } from '../contexts/AuthContext';

export interface UnifiedPresenceState {
    globalPresence: { [key: string]: PresenceData[] };
    chatPresence: { [key: string]: PresenceData[] };
    isOnline: (userId: string) => boolean | null;  // Return null when no presence data
    isTyping: (userId: string, chatId?: string) => boolean;
    updateTypingStatus: (chatId: string, isTyping: boolean) => Promise<void>;
    joinChatPresence: (chatId: string) => Promise<void>;
    leaveChatPresence: (chatId: string) => Promise<void>;
}

export const useUnifiedPresence = (chatId?: string): UnifiedPresenceState => {
    const { user } = useAuth();
    const [globalPresence, setGlobalPresence] = useState<{ [key: string]: PresenceData[] }>({});
    const [chatPresence, setChatPresence] = useState<{ [key: string]: PresenceData[] }>({});
    const presenceManagerRef = useRef<any>(null);
    const globalIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const chatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!user) return;

        const presenceManager = getPresenceManager();
        presenceManagerRef.current = presenceManager;

        // Set up global presence monitoring
        globalIntervalRef.current = setInterval(() => {
            const globalState = presenceManager.getGlobalPresenceState();
            setGlobalPresence(globalState);
        }, 3000); // Check every 3 seconds

        // Set up chat presence monitoring if chatId is provided
        if (chatId) {
            chatIntervalRef.current = setInterval(() => {
                const chatState = presenceManager.getChatPresenceState(chatId);
                console.log('useUnifiedPresence: Chat presence state update:', {
                    chatId,
                    stateKeys: Object.keys(chatState),
                    stateLength: chatState[chatId]?.length || 0,
                    rawState: chatState
                });

                // The presence state structure is { [userId]: PresenceData[] }
                // We need to convert it to { [chatId]: PresenceData[] } for our hook
                const presenceArray = Object.values(chatState).flat();
                setChatPresence(prev => ({
                    ...prev,
                    [chatId]: presenceArray
                }));
            }, 2000); // Check every 2 seconds
        }

        return () => {
            if (globalIntervalRef.current) {
                clearInterval(globalIntervalRef.current);
            }
            if (chatIntervalRef.current) {
                clearInterval(chatIntervalRef.current);
            }
        };
    }, [user, chatId]);

    // Memoize the isOnline function to prevent infinite re-renders
    const isOnline = useCallback((userId: string): boolean | null => {
        const userPresence = globalPresence[userId];

        if (!userPresence || userPresence.length === 0) return null;

        // Check if user has recent presence (within 30 seconds)
        const isOnlineResult = userPresence.some((presence: PresenceData) => {
            const lastSeen = new Date(presence.online_at).getTime();
            const now = new Date().getTime();
            const timeDiff = now - lastSeen;
            return timeDiff < 30000; // 30 seconds threshold
        });

        return isOnlineResult;
    }, [globalPresence]);

    // Memoize the isTyping function
    const isTyping = useCallback((userId: string, chatId?: string): boolean => {
        if (!chatId) return false;

        const chatState = chatPresence[chatId];
        if (!chatState || chatState.length === 0) {
            console.log('useUnifiedPresence: No chat state for chatId:', chatId);
            return false;
        }

        const userPresence = chatState.find((presence: PresenceData) => presence.user_id === userId);
        const typingStatus = userPresence?.isTyping || false;

        console.log('useUnifiedPresence: Checking typing status:', {
            userId,
            chatId,
            userPresence: !!userPresence,
            isTyping: typingStatus,
            chatStateLength: chatState.length,
            allUserIds: chatState.map((p: PresenceData) => p.user_id)
        });

        return typingStatus;
    }, [chatPresence]);

    // Memoize the updateTypingStatus function
    const updateTypingStatus = useCallback(async (chatId: string, isTyping: boolean): Promise<void> => {
        if (!presenceManagerRef.current) return;
        await presenceManagerRef.current.updateTypingStatus(chatId, isTyping);
    }, []);

    // Memoize the joinChatPresence function
    const joinChatPresence = useCallback(async (chatId: string): Promise<void> => {
        if (!presenceManagerRef.current) return;
        await presenceManagerRef.current.joinChatPresence(chatId);
    }, []);

    // Memoize the leaveChatPresence function
    const leaveChatPresence = useCallback(async (chatId: string): Promise<void> => {
        if (!presenceManagerRef.current) return;
        await presenceManagerRef.current.leaveChatPresence(chatId);
    }, []);

    // Memoize the return object to prevent unnecessary re-renders
    return useMemo(() => ({
        globalPresence,
        chatPresence,
        isOnline,
        isTyping,
        updateTypingStatus,
        joinChatPresence,
        leaveChatPresence
    }), [
        globalPresence,
        chatPresence,
        isOnline,
        isTyping,
        updateTypingStatus,
        joinChatPresence,
        leaveChatPresence
    ]);
}; 