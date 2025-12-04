import { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import React from 'react';

// Create a ref for navigation
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

export const useNavigation = () => {
    const safeNavigate = (screen: keyof RootStackParamList, maxRetries: number = 10) => {
        let retryCount = 0;

        const attemptNavigation = () => {
            if (navigationRef.current?.isReady()) {
                try {
                    navigationRef.current?.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{ name: screen }],
                        })
                    );
                } catch (error) {
                    console.error('Navigation error:', error);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(attemptNavigation, 200);
                    }
                }
            } else {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(attemptNavigation, 200);
                } else {
                    console.warn('Navigation not ready after maximum retries');
                }
            }
        };

        attemptNavigation();
    };

    return { safeNavigate };
}; 