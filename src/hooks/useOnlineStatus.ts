import { useState, useEffect } from 'react';
import { getOnlineStatusManager, OnlineStatusManager } from '../services/OnlineStatusManager';
import { useAuth } from '../contexts/AuthContext';

export const useOnlineStatus = () => {
    const { user } = useAuth();
    const [onlineManager, setOnlineManager] = useState<OnlineStatusManager | null>(null);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            const manager = getOnlineStatusManager();
            setOnlineManager(manager);

            // Get initial status
            if (manager) {
                manager.getOnlineStatus().then(status => {
                    setIsOnline(status?.online || false);
                });
            }
        } else {
            setOnlineManager(null);
            setIsOnline(null);
        }
    }, [user]);

    const setOnline = async () => {
        if (!onlineManager) return;

        setLoading(true);
        try {
            await onlineManager.setOnline();
            setIsOnline(true);
        } catch (error) {
            console.error('Failed to set online:', error);
        } finally {
            setLoading(false);
        }
    };

    const setOffline = async () => {
        if (!onlineManager) return;

        setLoading(true);
        try {
            await onlineManager.setOffline();
            setIsOnline(false);
        } catch (error) {
            console.error('Failed to set offline:', error);
        } finally {
            setLoading(false);
        }
    };

    const getOnlineUsers = async () => {
        try {
            return await OnlineStatusManager.getOnlineUsers();
        } catch (error) {
            console.error('Failed to get online users:', error);
            return [];
        }
    };

    return {
        isOnline,
        loading,
        setOnline,
        setOffline,
        getOnlineUsers,
        onlineManager
    };
}; 