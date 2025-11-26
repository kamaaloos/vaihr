import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import DriverHomeScreen from '../screens/DriverHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import InvoiceScreen from '../screens/InvoiceScreen';
import ChatListScreen from '../screens/ChatListScreen';
import { Badge } from 'react-native-paper';
import { View, Alert, StyleSheet } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { ParamListBase } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';

const Tab = createBottomTabNavigator();

const LogoutScreen = () => null; // Dummy component for logout tab

const TAB_ICON_SIZE = 24;
const TAB_BAR_HEIGHT = 60;

export type DriverTabParamList = {
  Home: undefined;
  Chat: undefined;
  Invoices: undefined;
  Settings: undefined;
  Profile: undefined;
  Logout: undefined;
};

type DriverTabScreenProps<T extends keyof DriverTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<DriverTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function DriverTabs() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCounts = async () => {
      try {
        // Fetch unread messages
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('count', { count: 'exact' })
          .eq('recipient_id', user.id)
          .eq('read', false);

        if (!msgError) {
          setUnreadMessages(messages?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();

    // Subscribe to message changes
    const messageSubscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, () => {
        fetchUnreadCounts();
      })
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [user?.id]);

  const handleLogoutPress = () => {
    Alert.alert(
      t('logout'),
      t('logout_confirmation') || 'Are you sure you want to logout?',
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: signOut
        }
      ]
    );
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Invoices') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Logout') {
            iconName = focused ? 'log-out' : 'log-out-outline';
          }

          return (
            <View style={styles.tabIconContainer}>
              <Ionicons
                name={iconName as any}
                size={TAB_ICON_SIZE}
                color={route.name === 'Logout' ? '#FF4444' : color}
              />
              {route.name === 'Chat' && unreadMessages > 0 && (
                <Badge size={16} style={styles.badge}>{unreadMessages}</Badge>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#6949FF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarButton: undefined
      })}
    >
      <Tab.Screen
        name="Home"
        component={DriverHomeScreen as React.ComponentType<any>}
        options={{ tabBarLabel: t('home') }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatListScreen as React.ComponentType<any>}
        options={{ title: t('chats'), tabBarLabel: t('chat') }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoiceScreen as React.ComponentType<any>}
        options={{ tabBarLabel: t('invoices') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen as React.ComponentType<any>}
        options={{ tabBarLabel: t('settings') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen as React.ComponentType<any>}
        options={{ tabBarLabel: t('profile') }}
      />
      <Tab.Screen
        name="Logout"
        component={LogoutScreen as React.ComponentType<any>}
        options={{ tabBarLabel: t('logout') }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleLogoutPress();
          },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: TAB_BAR_HEIGHT,
    paddingBottom: 8,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabBarItem: {
    height: TAB_BAR_HEIGHT - 16, // Accounting for padding
    padding: 0,
  },
  tabIconContainer: {
    width: TAB_ICON_SIZE + 16,
    height: TAB_ICON_SIZE + 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: TAB_ICON_SIZE + 16,
    height: TAB_ICON_SIZE + 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF4444',
  },
}); 