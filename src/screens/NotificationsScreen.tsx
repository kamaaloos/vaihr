import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Animated, PanResponder, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton, ActivityIndicator, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -100;

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: any;
  created_at: string;
}

interface NotificationItemProps {
  item: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
  surfaceColors: ReturnType<typeof getSurfaceColors>;
}

const NotificationItem = React.memo(({ item, onMarkAsRead, onDelete, isDarkMode, surfaceColors }: NotificationItemProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        return Math.abs(dx) > Math.abs(dy * 2);
      },
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) {
          translateX.setValue(dx);
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: -SCREEN_WIDTH,
            useNativeDriver: true,
            bounciness: 0,
          }).start(() => {
            onDelete(item.id);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      ref={rowRef}
      style={[
        styles.swipeableRow,
        {
          transform: [{ translateX }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Card
        style={[
          styles.card,
          { backgroundColor: surfaceColors.surface },
          !item.read && { backgroundColor: isDarkMode ? 'rgba(105, 73, 255, 0.2)' : '#F0F7FF' }
        ]}
        onPress={() => onMarkAsRead(item.id)}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.titleContainer}>
              <Text variant="titleMedium" style={[styles.title, { color: surfaceColors.text }]}>
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text variant="bodySmall" style={[styles.time, { color: surfaceColors.textSecondary }]}>
              {format(new Date(item.created_at), 'MMM d, h:mm a')}
            </Text>
          </View>
          <Text variant="bodyMedium" style={[styles.message, { color: surfaceColors.text }]}>
            {item.message}
          </Text>
        </Card.Content>
      </Card>
      <Animated.View
        style={[
          styles.deleteButtonContainer,
          {
            opacity: translateX.interpolate({
              inputRange: [-SCREEN_WIDTH, -100, 0],
              outputRange: [1, 1, 0],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            translateX.setValue(-SCREEN_WIDTH);
            Animated.spring(translateX, {
              toValue: -SCREEN_WIDTH,
              useNativeDriver: true,
              bounciness: 0,
            }).start(() => {
              onDelete(item.id);
            });
          }}
        >
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      if (!user?.id) {
        console.log('NotificationsScreen: No user ID available');
        setError('Please log in to view notifications');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('NotificationsScreen: Fetching notifications for user:', user.id);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('NotificationsScreen: Error fetching notifications:', fetchError);
        throw fetchError;
      }

      console.log('NotificationsScreen: Fetched notifications:', data?.length || 0);
      setNotifications(data || []);
      setError(null);
    } catch (err: any) {
      console.error('NotificationsScreen: Error fetching notifications:', err);
      const errorMessage = err?.message || 'Failed to load notifications';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    // Subscribe to notification changes
    console.log('NotificationsScreen: Setting up real-time subscription for user:', user.id);
    const subscription = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('NotificationsScreen: Real-time notification update received:', payload.eventType);
        fetchNotifications();
      })
      .subscribe((status) => {
        console.log('NotificationsScreen: Subscription status:', status);
      });

    return () => {
      console.log('NotificationsScreen: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(current =>
        current.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Remove from local state
      setNotifications(current =>
        current.filter(notification => notification.id !== notificationId)
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Notification deleted',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete notification',
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(current =>
        current.map(notification => ({ ...notification, read: true }))
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark notifications as read',
      });
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationItem
      item={item}
      onMarkAsRead={markAsRead}
      onDelete={deleteNotification}
      isDarkMode={isDarkMode}
      surfaceColors={surfaceColors}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: gradientColors[0] }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={surfaceColors.primary} />
          <Text style={[styles.loadingText, { color: surfaceColors.text }]}>
            Loading notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={[styles.headerTitle, { color: surfaceColors.text }]}>
            Notifications
          </Text>
          {notifications.some(n => !n.read) && (
            <Button
              mode="contained-tonal"
              onPress={markAllAsRead}
              style={styles.markAllButton}
            >
              Mark all as read
            </Button>
          )}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: '#FF4444' }]}>{error}</Text>
            <Button mode="outlined" onPress={fetchNotifications} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        )}

        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text variant="headlineSmall" style={{ color: surfaceColors.text }}>
                No notifications
              </Text>
              <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary, marginTop: 8 }}>
                {error ? 'Error loading notifications' : 'You\'re all caught up!'}
              </Text>
              {!error && (
                <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginTop: 4 }}>
                  Pull down to refresh
                </Text>
              )}
            </View>
          )}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  markAllButton: {
    backgroundColor: 'rgba(105, 73, 255, 0.1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    padding: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    marginRight: 8,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6949FF',
    marginLeft: 8,
  },
  time: {
    // Color applied dynamically
  },
  message: {
    // Color applied dynamically
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  swipeableRow: {
    marginBottom: 12,
    overflow: 'hidden',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    backgroundColor: '#FF4444',
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
}); 