import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { List, Switch, Text, Surface, Divider, RadioButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { commonStyles, colors } from '../styles/common';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import Copyright from '../components/Copyright';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const { user, userData } = useAuth();
  const [pushNotifications, setPushNotifications] = React.useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const { isDarkMode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigation = useNavigation<NavigationProp>();
  
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);

  // Check notification permission status on mount
  useEffect(() => {
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const isGranted = status === 'granted';
      setPushNotifications(isGranted);
      
      // Also check if user has push token saved
      if (userData?.expo_push_token && isGranted) {
        setPushNotifications(true);
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  };

  const handlePushNotificationToggle = async (value: boolean) => {
    if (value) {
      // User wants to enable notifications - request permissions
      setCheckingPermissions(true);
      try {
        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          // Request permission
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          // Permission granted - register for push notifications
          const token = await registerForPushNotificationsAsync();
          
          if (token) {
            // Update user record with push token
            if (user?.id) {
              const { error } = await supabase
                .from('users')
                .update({ expo_push_token: token })
                .eq('id', user.id);

              if (error) {
                console.error('Error saving push token:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to save push token',
                  position: 'bottom',
                });
                setPushNotifications(false);
                return;
              }
            }

            setPushNotifications(true);
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Push notifications enabled',
              position: 'bottom',
            });
          } else {
            setPushNotifications(false);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to get push token',
              position: 'bottom',
            });
          }
        } else {
          // Permission denied
          setPushNotifications(false);
          Alert.alert(
            'Permission Denied',
            'To receive push notifications, please enable notification permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    // On iOS, we can't directly open settings, but we can show instructions
                    Alert.alert(
                      'Enable Notifications',
                      'Go to Settings > [App Name] > Notifications and enable "Allow Notifications"'
                    );
                  } else {
                    // On Android, we can try to open app settings
                    // Note: This requires additional native module or Linking
                    Alert.alert(
                      'Enable Notifications',
                      'Go to Settings > Apps > [App Name] > Notifications and enable notifications'
                    );
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error enabling push notifications:', error);
        setPushNotifications(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to enable push notifications',
          position: 'bottom',
        });
      } finally {
        setCheckingPermissions(false);
      }
    } else {
      // User wants to disable notifications
      // Note: We can't revoke system permissions, but we can remove the push token
      if (user?.id) {
        const { error } = await supabase
          .from('users')
          .update({ expo_push_token: null })
          .eq('id', user.id);

        if (error) {
          console.error('Error removing push token:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to disable push notifications',
            position: 'bottom',
          });
          setPushNotifications(true); // Revert toggle
        } else {
          setPushNotifications(false);
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Push notifications disabled',
            position: 'bottom',
          });
        }
      }
    }
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <Surface style={[commonStyles.surface, { backgroundColor: surfaceColors.surface }]}>
      <Text variant="titleMedium" style={[commonStyles.sectionTitle, { color: surfaceColors.text }]}>{title}</Text>
      {children}
    </Surface>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={commonStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSection('Notifications', (
            <List.Section>
              <List.Item
                title="Push Notifications"
                description={pushNotifications ? "Notifications are enabled" : "Tap to enable push notifications"}
                left={props => <List.Icon {...props} icon="bell" color={colors.primary} />}
                right={() => (
                  checkingPermissions ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Switch
                      value={pushNotifications}
                      onValueChange={handlePushNotificationToggle}
                      color={colors.primary}
                    />
                  )
                )}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
                descriptionStyle={[styles.listItemDescription, { color: surfaceColors.textSecondary }]}
              />
              <Divider style={commonStyles.divider} />
              <List.Item
                title="Email Notifications"
                description="Receive email notifications for important updates"
                left={props => <List.Icon {...props} icon="email" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    color={colors.primary}
                  />
                )}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
                descriptionStyle={[styles.listItemDescription, { color: surfaceColors.textSecondary }]}
              />
            </List.Section>
          ))}

          {renderSection(t('appearance'), (
            <List.Section>
              <List.Item
                title={t('dark_mode')}
                description={t('dark_mode_description')}
                left={props => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={isDarkMode}
                    onValueChange={(value) => {
                      console.log('🌙 Dark mode toggle:', value);
                      toggleTheme();
                    }}
                    color={colors.primary}
                  />
                )}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
                descriptionStyle={[styles.listItemDescription, { color: surfaceColors.textSecondary }]}
              />
            </List.Section>
          ))}

          {renderSection('About', (
            <List.Section>
              <List.Item
                title="Version"
                description="1.0.0"
                left={props => <List.Icon {...props} icon="information" color={colors.primary} />}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
                descriptionStyle={[styles.listItemDescription, { color: surfaceColors.textSecondary }]}
              />
              <Divider style={[commonStyles.divider, { backgroundColor: surfaceColors.border }]} />
              <List.Item
                title="Terms of Service"
                left={props => <List.Icon {...props} icon="file-document" color={colors.primary} />}
                onPress={() => navigation.navigate('TermsOfService')}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
              />
              <Divider style={[commonStyles.divider, { backgroundColor: surfaceColors.border }]} />
              <List.Item
                title="Privacy Policy"
                left={props => <List.Icon {...props} icon="shield-account" color={colors.primary} />}
                onPress={() => {/* Handle press */}}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
              />
            </List.Section>
          ))}
          <Copyright />

          {renderSection(t('language'), (
            <List.Section>
              <List.Item
                title={t('finnish')}
                description="Suomi"
                left={props => <List.Icon {...props} icon="translate" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={language === 'fi'}
                    onValueChange={(value) => {
                      const newLanguage = value ? 'fi' : 'en';
                      console.log('🌐 Language toggle:', newLanguage);
                      setLanguage(newLanguage);
                    }}
                    color={colors.primary}
                  />
                )}
                titleStyle={[styles.listItemTitle, { color: surfaceColors.text }]}
                descriptionStyle={[styles.listItemDescription, { color: surfaceColors.textSecondary }]}
              />
            </List.Section>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  listItemDescription: {
    fontSize: 14,
  },
  radioItem: {
    marginVertical: 1,
  },
}); 