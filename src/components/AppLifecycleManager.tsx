import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getOnlineStatusManager } from '../services/OnlineStatusManager';

interface AppLifecycleManagerProps {
    children: React.ReactNode;
}

export const AppLifecycleManager: React.FC<AppLifecycleManagerProps> = ({ children }) => {
    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            const onlineManager = getOnlineStatusManager();

            if (!onlineManager) {
                console.log('AppLifecycleManager: No online manager available');
                return;
            }

            console.log('AppLifecycleManager: App state changed to:', nextAppState);

            try {
                if (nextAppState === 'active') {
                    // App came to foreground
                    console.log('AppLifecycleManager: App came to foreground, setting user online');
                    await onlineManager.setOnline();
                } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                    // App went to background
                    console.log('AppLifecycleManager: App went to background, setting user offline');
                    await onlineManager.setOffline();
                }
            } catch (error) {
                console.error('AppLifecycleManager: Error handling app state change:', error);
            }
        };

        // Add event listener
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Cleanup function
        return () => {
            subscription?.remove();
        };
    }, []);

    return <>{children}</>;
}; 