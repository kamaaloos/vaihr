import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Avatar, Surface, ActivityIndicator } from 'react-native-paper';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getPresenceManager } from '../services/PresenceManager';
import { useUnifiedPresence } from '../hooks/useUnifiedPresence';
import { navigationRef } from '../components/auth/useNavigation';
import { CommonActions, StackActions } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';
import { LinearGradient } from 'expo-linear-gradient';
import Copyright from '../components/Copyright';

interface AdminData {
  name: string;
  avatar_url?: string;
  email: string;
}

interface ChatData {
  id: string;
  admin_id: string;
  driver_id: string;
  admin: {
    email: string;
  };
  driver: {
    email: string;
  };
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

interface ChatPreview {
  id: string;
  admin_id: string;
  driver_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  other_user_is_online: boolean;
  current_user_is_driver: boolean;
  has_existing_chat: boolean;
}

interface UserMetadata {
  full_name: string;
  avatar_url?: string;
  is_online: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface UserData {
  id: string;
  name: string;
  profile_image?: string;
}

interface PresenceData {
  user_id: string;
  online_at: string;
  role?: string;
  presence_ref?: string;
}

type DriverTabParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
  Invoices: undefined;
  Chats: undefined;
};

type ChatScreenParams = RootStackParamList['Chat'];

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserIsDriver, setCurrentUserIsDriver] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const lastNavigationParams = useRef<string>(''); // Track last navigation params to prevent duplicates
  const renderCount = useRef(0); // Track render count

  // Increment render count and log
  renderCount.current += 1;
  console.log(`🔄 ChatListScreen: Render #${renderCount.current}`, {
    userId: user?.id,
    userRole: user?.role,
    chatsCount: chats.length,
    isNavigating,
    timestamp: new Date().toISOString()
  });

  // Use unified presence system
  const { isOnline } = useUnifiedPresence();

  // Update chat online status when presence changes
  useEffect(() => {
    if (!user) return;

    console.log('🔄 ChatListScreen: Presence effect triggered', {
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    setChats(prevChats => {
      // First, remove any duplicates that might exist
      const uniquePrevChats = prevChats.filter((chat, index, self) =>
        index === self.findIndex((c) => c.id === chat.id)
      );

      const updatedChats = uniquePrevChats.map(chat => {
        const presenceOnline = isOnline(chat.other_user_id);

        // Use presence status if available, otherwise keep existing status (which comes from database)
        const otherUserOnline = presenceOnline !== null ? presenceOnline : chat.other_user_is_online;

        return {
          ...chat,
          other_user_is_online: otherUserOnline
        };
      });

      // Final deduplication check
      return updatedChats.filter((chat, index, self) =>
        index === self.findIndex((c) => c.id === chat.id)
      );
    });
  }, [user, isOnline]);

  useEffect(() => {
    if (!user) return;

    console.log('🔄 ChatListScreen: useEffect triggered for fetchChats', {
      userId: user.id,
      userRole: user.role,
      timestamp: new Date().toISOString()
    });

    const fetchChats = async () => {
      try {
        // Get current user's role
        const { data: currentUserData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        const isDriver = currentUserData?.role === 'driver';
        setCurrentUserIsDriver(isDriver);

        if (isDriver) {
          // For drivers: Show all available admins, not just those with existing chats
          await fetchAvailableAdminsForDriver();
        } else {
          // For admins: Show existing chats with drivers (existing logic)
          await fetchExistingChats();
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
        setError('Failed to load chats');
      } finally {
        setLoading(false);
      }
    };

    const fetchAvailableAdminsForDriver = async () => {
      // Fetch all admin users
      const { data: adminsData, error: adminsError } = await supabase
        .from('users')
        .select('id, name, profile_image, role')
        .eq('role', 'admin');

      if (adminsError) {
        console.error('Error fetching admins:', adminsError);
        throw adminsError;
      }

      if (!adminsData || adminsData.length === 0) {
        setChats([]);
        return;
      }

      const adminIds = adminsData.map(admin => admin.id);

      // Test database connection and table access
      console.log('🔍 Testing database connection...');
      const { data: testData, error: testError } = await supabase
        .from('user_status')
        .select('count')
        .limit(1);

      console.log('🔍 Database connection test:', { testData, testError });

      // Fetch online status for all admins - query individually to avoid UUID casting issues
      let allStatusData = [];
      for (const adminId of adminIds) {
        const { data: statusData, error: statusError } = await supabase
          .from('user_status')
          .select('user_id, is_online, last_seen')
          .eq('user_id', adminId)
          .maybeSingle();

        if (statusError) {
          console.error(`Error fetching status for admin ${adminId}:`, statusError);
        } else if (statusData) {
          allStatusData.push(statusData);
        }
      }

      console.log('🔍 Raw status data from database:', allStatusData);
      console.log('🔍 Admin IDs being checked:', adminIds);

      // Create maps for quick lookup
      const adminMap = new Map();
      adminsData.forEach(admin => {
        adminMap.set(admin.id, admin);
      });

      const statusMap = new Map();
      allStatusData.forEach(status => {
        statusMap.set(status.user_id, status);
      });

      console.log('🔍 Status map created:', Object.fromEntries(statusMap));

      // Check for existing chats with each admin
      const { data: existingChatsData, error: chatsError } = await supabase
        .from('chats')
        .select('id, admin_id, driver_id, last_message')
        .eq('driver_id', user.id)
        .in('admin_id', adminIds);

      if (chatsError) {
        console.error('Error fetching existing chats:', chatsError);
      }

      const existingChatsMap = new Map();
      (existingChatsData || []).forEach(chat => {
        existingChatsMap.set(chat.admin_id, chat);
      });

      // Create chat previews for all admins
      const chatPreviews = await Promise.all(
        adminsData.map(async (admin) => {
          const existingChat = existingChatsMap.get(admin.id);
          const adminStatus = statusMap.get(admin.id);

          // Get online status from presence system if available, otherwise use database status
          let onlineStatus = false;
          if (isOnline) {
            const presenceOnline = isOnline(admin.id);
            // If presence data is available, use it; otherwise use database status
            onlineStatus = presenceOnline !== null ? presenceOnline : (adminStatus?.is_online || false);
          } else {
            onlineStatus = adminStatus?.is_online || false;
          }

          // If there's an existing chat, get the last message
          let lastMessage = 'No messages yet';
          let lastMessageTime = null;

          if (existingChat) {
            // Get the most recent non-deleted message for this chat
            const { data: lastMessageData, error: messageError } = await supabase
              .from('messages')
              .select('id, text, created_at, deleted')
              .eq('chat_id', existingChat.id)
              .eq('deleted', false)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (messageError && messageError.code !== 'PGRST116') {
              console.error('Error fetching last message:', messageError);
            }

            if (lastMessageData) {
              lastMessage = lastMessageData.text;
              lastMessageTime = lastMessageData.created_at;
            }
          }

          return {
            id: existingChat?.id || `temp-${admin.id}`, // Use temp ID if no chat exists
            admin_id: admin.id,
            driver_id: user.id,
            other_user_id: admin.id,
            other_user_name: admin.name,
            other_user_avatar_url: admin.profile_image,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            unread_count: 0,
            other_user_is_online: onlineStatus,
            current_user_is_driver: true,
            has_existing_chat: !!existingChat
          };
        })
      );

      console.log('📊 Final chat previews:', chatPreviews.map(cp => ({
        name: cp.other_user_name,
        online: cp.other_user_is_online,
        hasChat: cp.has_existing_chat
      })));

      // Remove duplicates based on ID before setting state
      const uniqueChats = chatPreviews.filter((chat, index, self) =>
        index === self.findIndex((c) => c.id === chat.id)
      );

      if (uniqueChats.length !== chatPreviews.length) {
        console.warn('⚠️ Duplicate chats detected and removed:', {
          original: chatPreviews.length,
          unique: uniqueChats.length,
          duplicates: chatPreviews.length - uniqueChats.length
        });
      }

      setChats(uniqueChats);
    };

    const fetchExistingChats = async () => {
      // Fetch chats for the current user (admin)
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select(`
          id, 
          admin_id, 
          driver_id, 
          last_message
        `)
        .eq('admin_id', user.id)
        .not('last_message', 'eq', null)
        .order('created_at', { ascending: false });

      if (chatsError) throw chatsError;

      if (chatsData && chatsData.length > 0) {
        // Get the driver IDs
        const driverIds = chatsData.map(chat => chat.driver_id);

        // Fetch driver metadata
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, profile_image, role')
          .in('id', driverIds);

        if (usersError) throw usersError;

        // Fetch online status from user_status table
        let allStatusData = [];
        for (const driverId of driverIds) {
          const { data: statusData, error: statusError } = await supabase
            .from('user_status')
            .select('user_id, is_online, last_seen')
            .eq('user_id', driverId)
            .maybeSingle();

          if (statusError) {
            console.error(`Error fetching status for driver ${driverId}:`, statusError);
          } else if (statusData) {
            allStatusData.push(statusData);
          }
        }

        if (allStatusData.length > 0) {
          console.log('🔍 Driver status data from database:', allStatusData);
        }

        // Create maps for quick lookup
        const userMap = new Map();
        (usersData || []).forEach(user => {
          userMap.set(user.id, user);
        });

        const statusMap = new Map();
        allStatusData.forEach(status => {
          statusMap.set(status.user_id, status);
        });

        // For each chat, get the most recent non-deleted message
        const chatsWithValidMessages = await Promise.all(
          chatsData.map(async (chat) => {
            // Get the most recent non-deleted message for this chat
            const { data: lastMessageData, error: messageError } = await supabase
              .from('messages')
              .select('id, text, created_at, deleted')
              .eq('chat_id', chat.id)
              .eq('deleted', false)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (messageError && messageError.code !== 'PGRST116') {
              console.error('Error fetching last message:', messageError);
            }

            // If no valid message found, skip this chat
            if (!lastMessageData) {
              return null;
            }

            const driverId = chat.driver_id;
            const driver = userMap.get(driverId);
            const driverStatus = statusMap.get(driverId);

            if (!driver) {
              console.warn('Driver not found for ID:', driverId);
              return null;
            }

            // Get online status from presence system if available, otherwise use database status
            let onlineStatus = false;
            if (isOnline) {
              const presenceOnline = isOnline(driverId);
              onlineStatus = presenceOnline !== null ? presenceOnline : (driverStatus?.is_online || false);
            } else {
              onlineStatus = driverStatus?.is_online || false;
            }

            return {
              id: chat.id,
              admin_id: chat.admin_id,
              driver_id: chat.driver_id,
              other_user_id: driverId,
              other_user_name: driver.name,
              other_user_avatar_url: driver.profile_image,
              last_message: lastMessageData.text,
              last_message_time: lastMessageData.created_at,
              unread_count: 0,
              other_user_is_online: onlineStatus,
              current_user_is_driver: false,
              has_existing_chat: true
            };
          })
        );

        // Filter out null values (chats with no valid messages)
        const validChats = chatsWithValidMessages.filter(chat => chat !== null) as ChatPreview[];
        
        // Remove duplicates based on ID before setting state
        const uniqueChats = validChats.filter((chat, index, self) =>
          index === self.findIndex((c) => c.id === chat.id)
        );

        if (uniqueChats.length !== validChats.length) {
          console.warn('⚠️ Duplicate chats detected and removed:', {
            original: validChats.length,
            unique: uniqueChats.length,
            duplicates: validChats.length - uniqueChats.length
          });
        }

        setChats(uniqueChats);
      } else {
        setChats([]);
      }
    };

    fetchChats();
  }, [user, isOnline]);

  const getLastSeenText = (chat: ChatPreview) => {
    return chat.other_user_is_online ? 'Online' : 'Offline';
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return format(new Date(dateString), 'MMM d');
    } catch {
      return '';
    }
  };

  const renderChat = ({ item }: { item: ChatPreview }) => {
    console.log('🎯 Rendering chat item:', {
      name: item.other_user_name,
      id: item.id,
      hasExistingChat: item.has_existing_chat,
      online: item.other_user_is_online
    });

    const hasUnread = (item.unread_count || 0) > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          console.log('👆 TouchableOpacity pressed:', {
            name: item.other_user_name,
            id: item.id,
            timestamp: new Date().toISOString(),
            renderCount: renderCount.current
          });

          const params = {
            driverId: item.other_user_id, // This will be admin_id for drivers, driver_id for admins
            driverName: item.other_user_name, // This will be admin_name for drivers, driver_name for admins
            chatId: item.has_existing_chat ? item.id : undefined, // Pass undefined if no existing chat, not null
            isOnline: item.other_user_is_online || false
          };

          // Validate parameters before navigation
          if (params.driverId === user?.id) {
            console.log('🚫 ChatListScreen: Invalid parameters - driverId is same as current user ID');
            return;
          }

          // Validate that all required parameters are present and valid
          if (!params.driverId || !params.driverName) {
            console.log('🚫 ChatListScreen: Missing required parameters');
            return;
          }

          // Create a unique key for this navigation to prevent duplicates
          const navigationKey = JSON.stringify({
            driverId: params.driverId,
            driverName: params.driverName,
            chatId: params.chatId,
            isOnline: params.isOnline
          });

          // Check if this is a duplicate navigation
          if (lastNavigationParams.current === navigationKey) {
            console.log('🚫 ChatListScreen: Duplicate navigation detected, skipping');
            return;
          }

          // Check if already navigating
          if (isNavigating) {
            console.log('🚫 ChatListScreen: Navigation already in progress, skipping');
            return;
          }

          console.log('🚀 ChatListScreen: Navigating to Chat with params:', params);

          try {
            setIsNavigating(true);
            lastNavigationParams.current = navigationKey; // Store the navigation key

            // Navigate to the parent stack navigator's Chat screen using reset
            navigationRef.current?.dispatch(
              CommonActions.reset({
                index: 1,
                routes: [
                  { name: 'DriverHome' },
                  { name: 'Chat', params }
                ],
              })
            );
            console.log('✅ Navigation successful');

            // Reset navigation flag after a delay
            setTimeout(() => {
              setIsNavigating(false);
              lastNavigationParams.current = ''; // Clear the navigation key after delay
            }, 1000);
          } catch (error) {
            console.error('❌ Navigation failed:', error);
            setIsNavigating(false);
            lastNavigationParams.current = ''; // Clear the navigation key on error
          }
        }}
      >
        <Surface style={[styles.chatCard, { backgroundColor: surfaceColors.surface }]} elevation={2}>
          <View style={[styles.chatContent, styles.chatContentOverflow]}>
            <View style={styles.avatarContainer}>
              <AvatarWithFallback
                size={56}
                imageUrl={item.other_user_avatar_url}
                fallbackLabel={item.other_user_name?.charAt(0) || 'U'}
              />
              {item.other_user_is_online && (
                <View style={[styles.onlineIndicator, { borderColor: surfaceColors.surface }]} />
              )}
            </View>
            
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text 
                  style={[
                    styles.userName, 
                    { color: surfaceColors.text },
                    hasUnread && styles.userNameUnread
                  ]}
                  numberOfLines={1}
                >
                  {item.other_user_name}
                </Text>
                {item.last_message_time && (
                  <Text style={[styles.timeText, { color: surfaceColors.textSecondary }]}>
                    {formatTime(item.last_message_time)}
                  </Text>
                )}
              </View>
              
              <View style={styles.messageRow}>
                <Text 
                  style={[
                    styles.lastMessage, 
                    { color: hasUnread ? surfaceColors.text : surfaceColors.textSecondary },
                    hasUnread && styles.lastMessageUnread
                  ]} 
                  numberOfLines={1}
                >
                  {item.last_message || 'No messages yet'}
                </Text>
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>
                      {item.unread_count! > 99 ? '99+' : item.unread_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4083FF" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          style={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: surfaceColors.text }]}>
                {currentUserIsDriver ? 'No admins available' : 'No chats yet'}
              </Text>
              <Text style={[styles.emptySubText, { color: surfaceColors.textSecondary }]}>
                {currentUserIsDriver
                  ? 'No admin users are currently online. Please check back later.'
                  : 'Your chat history will appear here'
                }
              </Text>
            </View>
          }
          ListFooterComponent={<Copyright />}
          ListFooterComponentStyle={styles.footer}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

export default ChatListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContainer: {
    padding: 12,
    flexGrow: 1,
  },
  chatCard: {
    marginBottom: 12,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  chatContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  chatContentOverflow: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
  },
  chatInfo: {
    flex: 1,
    minWidth: 0, // Allows text to truncate properly
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  userNameUnread: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#4083FF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingVertical: 16,
  },
});
