import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { LogBox, Platform, View, ActivityIndicator, Text, Button, Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, Button as PaperButton } from 'react-native-paper';
import { RootStackParamList } from './src/types';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { navigationRef } from './src/components/auth/useNavigation';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Toast from 'react-native-toast-message';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ChatProvider } from './src/contexts/ChatContext';
import { startOnlineStatusTracking } from './src/utils/onlineStatus';
import { enGB, registerTranslation } from 'react-native-paper-dates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/config/supabase';
import { JobsProvider } from './src/contexts/JobsContext';
import { usePresenceNotifications } from './src/hooks/usePresenceNotifications';
import { AppLifecycleManager } from './src/components/AppLifecycleManager';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DriverHomeScreen from './src/screens/DriverHomeScreen';
import AdminHomeScreen from './src/screens/AdminHomeScreen';
import JobDetailsScreen from './src/screens/JobDetailsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import DriverTabs from './src/navigation/DriverTabs';
import InvoiceScreen from './src/screens/InvoiceScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import UploadTermsScreen from './src/screens/UploadTermsScreen';
import DriversListScreen from './src/screens/DriversListScreen';
import ChatScreen from './src/screens/ChatScreen';
import AddJobScreen from './src/screens/AddJobScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import { StackScreenProps } from '@react-navigation/stack';


// Ignore specific warnings if needed
LogBox.ignoreLogs(['Warning: ...']); // Optional

// Define the correct type for props
type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

const Stack = createNativeStackNavigator<RootStackParamList>();

// Configure notifications behavior with error handling
// This ensures all notifications (including push notifications) play sound on both iOS and Android
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      const platform = Platform.OS;
      console.log(`Notification received (${platform}):`, {
        title: notification.request.content.title,
        body: notification.request.content.body,
        sound: notification.request.content.sound,
        hasSound: !!notification.request.content.sound,
        platform,
      });

      return {
        shouldShowAlert: true,
        shouldPlaySound: true, // Explicitly enable sound for both iOS and Android
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        ...(Platform.OS === 'android' && {
          priority: Notifications.AndroidNotificationPriority.MAX, // Use MAX for better sound delivery on Android
        }),
      };
    } catch (error) {
      console.warn('Error handling notification:', error);
      // Even on error, try to play sound
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        ...(Platform.OS === 'android' && {
          priority: Notifications.AndroidNotificationPriority.MAX,
        }),
      };
    }
  },
});

// Register the English locale for the date picker
registerTranslation('en-GB', enGB);

async function registerForPushNotificationsAsync() {
  let token;

  // Configure Android notification channel (iOS doesn't need channels)
  if (Platform.OS === 'android') {
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
      sound: 'default', // CRITICAL: This enables sound on Android
      showBadge: true,
    });
    console.log('✅ Android notification channel created with sound enabled');
  } else if (Platform.OS === 'ios') {
    console.log('✅ iOS notifications configured - sound enabled by default');
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'f3360809-2bdc-4cdd-b766-913ec1c1deb4'
      })).data;

      // Save the token to the user's record
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && token) {
        const { error } = await supabase
          .from('users')
          .update({ expo_push_token: token })
          .eq('id', user.id);

        if (error) {
          console.error('Error saving push token:', error);
        } else {
          console.log('Successfully saved push token for user');
        }
      }
    } catch (error) {
      // Check if it's a network error (503, connection issues, etc.)
      const isNetworkError = error instanceof Error && (
        error.message.toLowerCase().includes('503') ||
        error.message.toLowerCase().includes('upstream connect error') ||
        error.message.toLowerCase().includes('connection termination') ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('temporarily unavailable')
      );

      if (isNetworkError) {
        console.warn('⚠️ Expo push token service temporarily unavailable (network error). This is usually temporary.');
        console.warn('Error details:', error instanceof Error ? error.message : 'Unknown error');
        console.warn('💡 Local notifications will still work. You can try registering again later.');
      } else {
        console.error('Error getting push token:', error);
      }
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Move this outside of the Navigation component
const ChatScreenWithProvider = (props: ChatScreenProps) => (
  <ChatProvider>
    <ChatScreen {...props} />
  </ChatProvider>
);

function Navigation() {
  const { user, userData, loading } = useAuth();

  // Wait for auth to finish loading before making navigation decisions
  // If we have a user but userData is still loading, show loading screen
  if (loading || (user && !userData)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6949FF" />
      </View>
    );
  }

  const isAdmin = userData?.role === 'admin';

  // Drivers must complete profile; admins bypass completion
  // Handle both boolean true and string "true" from database
  // Treat null/undefined/false as incomplete
  const profileCompleted = userData?.profile_completed === true
    || userData?.profile_completed === 'true'
    || userData?.profile_completed === 1
    || userData?.profile_completed === '1';

  const needsProfileCompletion = !!user
    && userData
    && userData.role !== 'admin'
    && !profileCompleted;

  console.log('Navigation: Profile completion check:', {
    hasUser: !!user,
    hasUserData: !!userData,
    loading,
    role: userData?.role,
    profile_completed: userData?.profile_completed,
    profile_completed_type: typeof userData?.profile_completed,
    profileCompleted,
    needsProfileCompletion,
    rawUserData: userData ? JSON.stringify(userData).substring(0, 200) : 'no data'
  });

  // Determine initial route name based on current state
  let initialRouteName: keyof RootStackParamList = 'Welcome';
  if (user && userData) {
    if (needsProfileCompletion) {
      initialRouteName = 'CompleteProfile';
    } else if (isAdmin) {
      initialRouteName = 'AdminHome';
    } else {
      initialRouteName = 'DriverHome';
    }
  }

  return (
    <Stack.Navigator
      key={`${user?.id || 'no-user'}-${needsProfileCompletion ? 'complete' : 'done'}-${isAdmin ? 'admin' : 'driver'}`}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: true,
      }}
    >
      {!user ? (
        // Auth screens
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CompleteProfile"
            component={CompleteProfileScreen}
            options={{
              headerShown: false,
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              title: 'Terms of Service',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTintColor: '#333',
            }}
          />
        </>
      ) : needsProfileCompletion ? (
        // Force profile completion flow
        <>
          <Stack.Screen
            name="CompleteProfile"
            component={CompleteProfileScreen}
            options={{
              headerShown: false,
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              title: 'Terms of Service',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTintColor: '#333',
            }}
          />
        </>
      ) : isAdmin ? (
        // Admin screens
        <>
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreenWithProvider} />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Profile' }}
          />
          <Stack.Screen
            name="AddJob"
            component={AddJobScreen}
            options={{ title: 'Create New Job' }}
          />
          <Stack.Screen
            name="JobDetails"
            component={JobDetailsScreen}
            options={{ title: 'Job Details' }}
          />
          <Stack.Screen
            name="Invoice"
            component={InvoiceScreen}
            options={{ title: 'Invoices' }}
          />
          <Stack.Screen
            name="DriversList"
            component={DriversListScreen}
            options={{ title: 'Drivers' }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: 'User Profile' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              title: 'Terms of Service',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTintColor: '#333',
            }}
          />
          <Stack.Screen
            name="UploadTerms"
            component={UploadTermsScreen}
            options={{
              title: 'Upload Terms',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTintColor: '#333',
            }}
          />
        </>
      ) : (
        // Driver screens
        <>
          <Stack.Screen
            name="DriverHome"
            component={DriverTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Chat" component={ChatScreenWithProvider} />
          <Stack.Screen
            name="JobDetails"
            component={JobDetailsScreen}
            options={{ title: 'Job Details' }}
          />
          <Stack.Screen
            name="Invoice"
            component={InvoiceScreen}
            options={{ title: 'Invoices' }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: 'User Profile' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen
            name="CompleteProfile"
            component={CompleteProfileScreen}
            options={{
              headerShown: false,
              gestureEnabled: false
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{
              title: 'Terms of Service',
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTintColor: '#333',
            }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{
              headerShown: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { user, userData } = useAuth();

  // Add online status tracking
  useEffect(() => {
    if (!user) return;

    // Start tracking and get cleanup function
    const cleanup = startOnlineStatusTracking(user.id);

    // Clean up when component unmounts or user changes
    return cleanup;
  }, [user]);

  // Automatically register for push notifications when user logs in
  useEffect(() => {
    if (!user || !userData) return;

    // Only register if user doesn't have a push token
    if (!userData.expo_push_token) {
      console.log('User has no push token, attempting to register...');
      registerForPushNotificationsAsync().catch(error => {
        // Check if it's a network error
        const isNetworkError = error instanceof Error && (
          error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('503') ||
          error.message.toLowerCase().includes('temporarily unavailable') ||
          error.message.toLowerCase().includes('unable to connect')
        );

        if (isNetworkError) {
          console.warn('⚠️ Push notification registration failed due to network error. Local notifications will still work.');
          console.warn('Error details:', error instanceof Error ? error.message : 'Unknown error');
        } else {
          console.error('Failed to register for push notifications:', error);
        }
        // Don't show error to user - they can enable it manually in settings
        // Local notifications will still work even if push token registration fails
      });
    }
  }, [user?.id, userData?.expo_push_token]);

  // Add presence notifications
  usePresenceNotifications();

  // Handle deep links for password reset
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);

      try {
        // Check if this is a password reset URL (Supabase callback or deep link)
        // Note: Even if there's an error in query params, tokens might be in hash
        const isPasswordReset = url.includes('/auth/v1/callback') ||
          url.includes('type=recovery') ||
          url.startsWith('vaihtoratti://reset-password');

        if (isPasswordReset) {
          console.log('Processing password reset URL:', url.substring(0, 100) + '...');

          // Extract tokens from URL hash (Supabase puts tokens in hash fragment)
          let accessToken: string | null = null;
          let refreshToken: string | null = null;
          const hash = url.split('#')[1];

          if (hash) {
            // Parse hash fragment which contains: access_token=...&refresh_token=...&type=recovery
            const params = new URLSearchParams(hash);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            const type = params.get('type');

            console.log('Extracted from hash:', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              type: type
            });
          }

          // If no hash, try query params (fallback for deep link format)
          if (!accessToken || !refreshToken) {
            try {
              const urlObj = new URL(url.replace('vaihtoratti://', 'https://'));
              accessToken = urlObj.searchParams.get('access_token') || accessToken;
              refreshToken = urlObj.searchParams.get('refresh_token') || refreshToken;
            } catch (e) {
              console.log('Could not parse URL for query params:', e);
            }
          }

          if (accessToken && refreshToken) {
            console.log('Password reset tokens found, setting session...');

            // Set the session in Supabase
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Error setting session:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to process password reset link. It may have expired.',
                position: 'bottom',
              });
              return;
            }

            if (data.session && data.user) {
              console.log('Session set successfully, navigating to reset password screen...');
              // Extract email from user data
              const email = data.user.email || '';
              // Navigate to reset password screen
              navigationRef.current?.navigate('ResetPassword', { email });
            }
          } else {
            console.log('No tokens found in URL');
            // If it's a deep link without tokens, navigate to reset screen anyway
            // User will need to request a new reset link
            if (url.startsWith('vaihtoratti://reset-password')) {
              navigationRef.current?.navigate('ResetPassword', {});
            } else {
              // Show error if we can't extract tokens
              Toast.show({
                type: 'error',
                text1: 'Invalid Link',
                text2: 'The password reset link is invalid. Please request a new one.',
                position: 'bottom',
              });
            }
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to process password reset link',
          position: 'bottom',
        });
      }
    };

    // Handle initial URL (when app is opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL detected:', url);
        handleDeepLink(url);
      }
    }).catch(err => {
      console.error('Error getting initial URL:', err);
    });

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('URL event received:', url);
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <LanguageProvider>
        <AppLifecycleManager>
          <Navigation />
        </AppLifecycleManager>
      </LanguageProvider>
    </PaperProvider>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize any app-wide services here
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6949FF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <JobsProvider>
            <NavigationContainer ref={navigationRef}>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </NavigationContainer>
          </JobsProvider>
        </AuthProvider>
        {/* @ts-ignore - react-native-toast-message type issue */}
        <Toast />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Navigation error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong with navigation.</Text>
          <PaperButton
            mode="contained"
            onPress={() => this.setState({ hasError: false })}
            style={{ marginTop: 10 }}
          >
            Try Again
          </PaperButton>
        </View>
      );
    }

    return this.props.children;
  }
} 