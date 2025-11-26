import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';
import { supabaseMigration } from '../config/supabaseMigration';

// Note: Notification handler is configured in App.tsx
// This ensures consistent behavior across the app

export const registerForPushNotificationsAsync = async () => {
    let token;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    console.log('Starting push notification registration...');

    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            throw new Error('No authenticated user found');
        }

        // Get user data
        const { data: userData, error: userError } = await supabaseMigration
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError) {
            console.error('Error fetching user data:', userError);
            throw new Error('Failed to fetch user data');
        }

        console.log('User data:', userData);

        if (Platform.OS === 'android') {
            console.log('Setting up Android notification channel...');
            // Delete existing channel if it exists (channels can't be modified, only recreated)
            try {
                await Notifications.deleteNotificationChannelAsync('default');
                console.log('Deleted existing notification channel');
            } catch (error) {
                console.log('No existing channel to delete (this is OK)');
            }
            
            // Create new channel with sound enabled
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default Notifications',
                description: 'Default notification channel for app notifications with sound',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                enableVibrate: true,
                enableLights: true,
                sound: 'default', // CRITICAL: This enables sound
                showBadge: true,
            });
            console.log('✅ Android notification channel created with sound enabled');
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        console.log('Current notification permission status:', existingStatus);

        if (existingStatus !== 'granted') {
            console.log('Requesting notification permissions...');
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            console.log('New permission status:', status);
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get notification permissions');
            throw new Error('Permission not granted for notifications');
        }

        const getToken = async (): Promise<string> => {
            console.log('Getting Expo push token...');
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (!projectId) {
                throw new Error('Project ID is not configured in app.json');
            }

            try {
                const tokenResponse = await Notifications.getExpoPushTokenAsync({
                    projectId
                });
                return tokenResponse.data;
            } catch (error) {
                // Handle network errors from Expo servers (503, connection issues, etc.)
                if (error instanceof Error) {
                    const errorMessage = error.message.toLowerCase();
                    if (errorMessage.includes('503') || 
                        errorMessage.includes('upstream connect error') || 
                        errorMessage.includes('connection termination') ||
                        errorMessage.includes('network') ||
                        errorMessage.includes('timeout')) {
                        console.warn('⚠️ Expo push token service temporarily unavailable (network error). This is usually temporary.');
                        console.warn('Error details:', error.message);
                        // Re-throw with a more user-friendly message
                        throw new Error('Network error: Expo push notification service is temporarily unavailable. Please try again later.');
                    }
                }
                // Re-throw other errors as-is
                throw error;
            }
        };

        const updateToken = async (token: string): Promise<boolean> => {
            try {
                // Try regular client first
                console.log('Attempting token update with regular client...');
                const { error: regularError } = await supabase
                    .from('users')
                    .update({
                        expo_push_token: token,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (regularError) {
                    console.error('Error with regular client:', regularError);

                    // Try direct update with migration client
                    console.log('Trying migration client direct update...');
                    const { error: updateError } = await supabaseMigration
                        .from('users')
                        .update({
                            expo_push_token: token,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', user.id);

                    if (updateError) {
                        console.error('Error with migration client direct update:', updateError);
                        // Try RPC function as last resort
                        console.log('Trying RPC function...');
                        const { error: rpcError } = await supabaseMigration.rpc(
                            'update_user_push_token',
                            {
                                p_user_id: user.id,
                                p_token: token
                            }
                        );

                        if (rpcError) {
                            console.error('Error with RPC function:', rpcError);
                            return false;
                        }
                    }
                }

                // Add a delay before verification
                console.log('Waiting for database propagation...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Try verification with regular client first
                console.log('Verifying with regular client...');
                const { data: regularVerifyData, error: regularVerifyError } = await supabase
                    .from('users')
                    .select('expo_push_token')
                    .eq('id', user.id)
                    .single();

                if (regularVerifyError || regularVerifyData?.expo_push_token !== token) {
                    console.log('Regular client verification failed, trying migration client...');
                    // Fall back to migration client for verification
                    const { data: verifyData, error: verifyError } = await supabaseMigration
                        .from('users')
                        .select('expo_push_token')
                        .eq('id', user.id)
                        .single();

                    if (verifyError) {
                        console.error('Error in verification with migration client:', verifyError);
                        return false;
                    }

                    if (verifyData?.expo_push_token !== token) {
                        console.error('Token verification failed:', {
                            saved: verifyData?.expo_push_token,
                            expected: token,
                            userId: user.id
                        });
                        return false;
                    }
                }

                console.log('Successfully saved and verified push token');
                return true;
            } catch (error) {
                console.error('Error updating token:', error);
                if (error instanceof Error) {
                    console.error('Error details:', {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    });
                }
                return false;
            }
        };

        // Try to get and update token with retries
        while (retryCount < MAX_RETRIES) {
            try {
                token = await getToken();
                console.log('Successfully got push token:', token);

                const success = await updateToken(token);
                if (success) {
                    return token;
                }

                console.log(`Token update failed, attempt ${retryCount + 1} of ${MAX_RETRIES}`);
                console.log('Current token state:', { token, userId: user.id });

                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    const delay = 2000 * Math.pow(2, retryCount - 1); // Exponential backoff
                    console.log(`Waiting ${delay}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                const isNetworkError = error instanceof Error && (
                    error.message.toLowerCase().includes('network') ||
                    error.message.toLowerCase().includes('503') ||
                    error.message.toLowerCase().includes('temporarily unavailable') ||
                    error.message.toLowerCase().includes('upstream connect error') ||
                    error.message.toLowerCase().includes('connection termination')
                );

                if (isNetworkError) {
                    console.warn(`⚠️ Network error in attempt ${retryCount + 1}/${MAX_RETRIES}:`, error instanceof Error ? error.message : 'Unknown error');
                } else {
                    console.error(`Error in attempt ${retryCount + 1}/${MAX_RETRIES}:`, error);
                }

                if (error instanceof Error) {
                    console.error('Attempt error details:', {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    });
                }
                
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    // Use longer delays for network errors
                    const baseDelay = isNetworkError ? 5000 : 2000; // 5s for network errors, 2s for others
                    const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
                    console.log(`Waiting ${delay}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // On final failure, provide a helpful error message
                    if (isNetworkError) {
                        throw new Error('Unable to connect to Expo push notification service. Please check your internet connection and try again later. Local notifications will still work.');
                    }
                    throw error;
                }
            }
        }

        throw new Error(`Failed to register push token after ${MAX_RETRIES} attempts. Last token: ${token}`);
    } catch (error) {
        const isNetworkError = error instanceof Error && (
            error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('503') ||
            error.message.toLowerCase().includes('temporarily unavailable') ||
            error.message.toLowerCase().includes('unable to connect')
        );

        if (isNetworkError) {
            console.warn('⚠️ Push notification registration failed due to network error:', error instanceof Error ? error.message : 'Unknown error');
            console.warn('💡 Local notifications will still work. You can try registering again later when the network is stable.');
        } else {
            console.error('Error in push notification setup:', error);
        }

        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        }
        throw error;
    }
};

// Function to show a local notification immediately
export const showLocalNotification = async (title: string, body: string) => {
    try {
        const notificationContent: any = {
            title,
            body,
            sound: 'default', // Works on both iOS and Android
            ...(Platform.OS === 'android' && {
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 250, 250, 250],
                channelId: 'default',
            }),
            ...(Platform.OS === 'ios' && {
                sound: 'default',
                badge: 1,
            }),
        };

        await Notifications.scheduleNotificationAsync({
            content: notificationContent,
            trigger: null, // Show immediately
        });
        console.log(`Local notification scheduled successfully with sound (${Platform.OS})`);
    } catch (error) {
        console.error('Error showing local notification:', error);
        throw error;
    }
};

export const sendPushNotification = async (
    expoPushToken: string,
    title: string,
    body: string,
    options?: { sound?: string }
) => {
    // Check if we're running in Expo Go (remote push notifications don't work in Expo Go SDK 53+)
    // Use string comparison to avoid undefined errors
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    
    if (isExpoGo) {
        console.log('⚠️ Running in Expo Go - remote push notifications are not supported. Using local notifications only.');
        // In Expo Go, only use local notifications (which work fine)
        await showLocalNotification(title, body);
        return;
    }

    if (!expoPushToken) {
        console.error('Expo push token is missing! Falling back to local notification.');
        // Fallback to local notification if no token
        await showLocalNotification(title, body);
        return;
    }

    try {
        console.log('sendPushNotification called:', {
            title,
            body,
            hasToken: !!expoPushToken,
            sound: options?.sound || 'default',
            environment: Constants.executionEnvironment
        });

        // Always show a local notification first (works in all environments)
        await showLocalNotification(title, body);

        // Try to send remote push notification (only works in development builds, not Expo Go)
        const message = {
            to: expoPushToken,
            sound: options?.sound || 'default',
            title: title,
            body: body,
            priority: 'high',
            channelId: 'default',
            badge: 1,
            data: {
                title,
                body,
                timestamp: new Date().toISOString()
            },
            android: {
                priority: 'high',
                sound: options?.sound || 'default',
                vibrate: [0, 250, 250, 250],
                channelId: 'default',
                sticky: false,
            },
            ios: {
                sound: options?.sound || 'default',
                badge: 1,
            }
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.warn('Remote push notification failed (this is expected in Expo Go):', errorData);
            // Don't throw - local notification already shown
            return;
        }

        const responseData = await response.json();
        console.log('Remote push notification sent successfully:', {
            success: responseData,
            soundIncluded: message.sound,
            androidSound: message.android?.sound,
            iosSound: message.ios?.sound
        });
    } catch (error) {
        console.warn('Error sending remote push notification (local notification was already shown):', error);
        // Don't throw - local notification already shown, which is what matters in Expo Go
    }
}; 