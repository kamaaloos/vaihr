import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Avatar, Surface, ActivityIndicator, IconButton, Searchbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useUnifiedPresence } from '../hooks/useUnifiedPresence';
import { navigationRef } from '../components/auth/useNavigation';
import { CommonActions } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Copyright from '../components/Copyright';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Driver {
  id: string;
  name: string;
  is_online: boolean;
  last_seen: string | null;
  avatar_url?: string;
  expo_push_token?: string;
  driver_type?: string;
  rating?: number;
  total_jobs?: number;
  completed_jobs?: number;
  role: string;
}

export default function DriversListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Use unified presence system
  const { isOnline } = useUnifiedPresence();

  const fetchDrivers = useCallback(async () => {
    console.log('🚀 fetchDrivers: FUNCTION CALLED - Starting fetch...');
    try {
      setError(null);
      console.log('Fetching drivers...');

      // First get all drivers with basic info
      const { data: driversData, error: driversError } = await supabase
        .from('users')
        .select('*, profile_image')
        .eq('role', 'driver');

      if (driversError) {
        console.error('Error fetching drivers:', driversError);
        throw driversError;
      }

      console.log('Raw drivers data:', JSON.stringify(driversData, null, 2));

      // Debug: Check Hasan Kamaal's raw data
      const hasanRaw = driversData?.find(d => d.id === '617e7a07-9a4d-4b92-9465-f8f6f52e910b');
      console.log('🔍 Debug: Hasan Kamaal raw data:', {
        found: !!hasanRaw,
        rawData: hasanRaw,
        allDrivers: driversData?.map(d => ({ id: d.id, name: d.name, online: d.online }))
      });

      // Get status data separately
      const driverIds = driversData?.map(d => d.id) || [];
      console.log('Attempting to fetch status data for drivers:', {
        driverIds,
        userRole: user?.user_metadata?.role,
        userId: user?.id
      });

      let { data: statusData, error: statusError } = await supabase
        .from('user_status')
        .select('*')
        .in('user_id', driverIds);

      if (statusError) {
        console.error('Error fetching status:', statusError);
        console.error('Error details:', {
          code: statusError.code,
          message: statusError.message,
          details: statusError.details,
          hint: statusError.hint
        });
        // Don't throw error, just log it and continue with empty status data
        statusData = [];
      }

      console.log('Status query result:', {
        statusData,
        count: statusData?.length,
        driverIds: driverIds,
        query: `SELECT * FROM user_status WHERE user_id IN (${driverIds.map(id => `'${id}'`).join(',')})`
      });

      // Debug: Check if Hasan Kamaal's status record exists
      const hasanStatus = statusData?.find(status => status.user_id === '617e7a07-9a4d-4b92-9465-f8f6f52e910b');
      console.log('🔍 Debug: Hasan Kamaal status record:', {
        found: !!hasanStatus,
        statusRecord: hasanStatus,
        allStatusRecords: statusData
      });

      // Transform the data
      const transformedData = driversData?.map(driver => {
        const driverId = driver.id;

        // Find the corresponding status data for this driver
        const statusRecord = statusData?.find(status => status.user_id === driverId);

        // Use online status from user_status table, fallback to users table
        const isOnline = statusRecord?.is_online ?? driver.online ?? false;
        const lastSeen = statusRecord?.last_seen ?? driver.updated_at ?? null;

        console.log(`Driver ${driverId} status:`, {
          name: driver.full_name || driver.email?.split('@')[0] || 'Unknown',
          statusRecord: statusRecord,
          usersOnline: driver.online,
          statusOnline: statusRecord?.is_online,
          finalIsOnline: isOnline,
          lastSeen: lastSeen
        });

        return {
          id: driverId,
          name: driver.full_name || driver.email?.split('@')[0] || 'Unknown',
          email: driver.email,
          expo_push_token: driver.expo_push_token,
          avatar_url: driver.profile_image || driver.avatar_url,
          driver_type: driver.driver_type,
          rating: driver.rating ? parseFloat(driver.rating) : undefined,
          total_jobs: driver.total_jobs ? parseInt(driver.total_jobs) : undefined,
          completed_jobs: driver.completed_jobs ? parseInt(driver.completed_jobs) : undefined,
          last_seen: lastSeen,
          is_online: isOnline,
          role: 'driver'
        };
      }) || [];

      console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
      setDrivers(transformedData);
    } catch (error: any) {
      console.error('Error in fetchDrivers:', error);
      setError(error.message);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load drivers: ' + error.message,
        position: 'bottom',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  }, [fetchDrivers]);

  useEffect(() => {
    if (!user) return;

    console.log('🔄 DriversListScreen: Starting data fetch and subscriptions');
    fetchDrivers().finally(() => setLoading(false));

    // Subscribe to changes in user_status
    const statusSubscription = supabase
      .channel('user_status_changes')
      .on(
        'postgres_changes' as 'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status'
        },
        (payload) => {
          console.log('🔄 DriversListScreen: User status changed:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new,
            table: payload.table
          });

          if (!payload.new) return;
          const newStatus = payload.new as { user_id: string; last_seen: string | null; is_online: boolean };

          setDrivers(prevDrivers => {
            const updatedDrivers = prevDrivers.map(driver => {
              if (driver.id === newStatus.user_id) {
                const updatedDriver = {
                  ...driver,
                  is_online: newStatus.is_online,
                  last_seen: newStatus.last_seen || new Date().toISOString()
                };
                console.log('✅ DriversListScreen: Updated driver status:', {
                  driverId: driver.id,
                  driverName: driver.name,
                  oldStatus: driver.is_online,
                  newStatus: newStatus.is_online,
                  updatedDriver: updatedDriver
                });
                return updatedDriver;
              }
              return driver;
            });

            console.log('📊 DriversListScreen: Updated drivers list:', {
              totalDrivers: updatedDrivers.length,
              onlineDrivers: updatedDrivers.filter(d => d.is_online).length,
              onlineDriverNames: updatedDrivers.filter(d => d.is_online).map(d => d.name)
            });

            return updatedDrivers;
          });
        }
      )
      .subscribe() as RealtimeChannel;

    // Subscribe to changes in users
    const userSubscription = supabase
      .channel('user_changes')
      .on(
        'postgres_changes' as 'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.driver'
        },
        (payload) => {
          console.log('🔄 DriversListScreen: User data changed:', payload);
          fetchDrivers();
        }
      )
      .subscribe() as RealtimeChannel;

    return () => {
      console.log('🔄 DriversListScreen: Unsubscribing from changes...');
      statusSubscription.unsubscribe();
      userSubscription.unsubscribe();
    };
  }, [user, fetchDrivers]);

  // Update driver online status when presence changes - memoized to prevent unnecessary re-renders
  const updatedDrivers = useMemo(() => {
    if (!user) return drivers;

    return drivers.map(driver => {
      const presenceOnline = isOnline(driver.id);

      // Use presence status if available, otherwise fall back to database status
      const finalOnlineStatus = presenceOnline !== null ? presenceOnline : driver.is_online;

      console.log(`🔄 DriversListScreen: Driver ${driver.name} status:`, {
        driverId: driver.id,
        databaseOnline: driver.is_online,
        presenceOnline: presenceOnline,
        finalOnlineStatus: finalOnlineStatus,
        hasPresenceData: presenceOnline !== null
      });

      return {
        ...driver,
        is_online: finalOnlineStatus
      };
    });
  }, [drivers, user, isOnline]);

  // Use updatedDrivers instead of drivers for rendering
  const filteredDrivers = useMemo(() => {
    if (searchQuery.trim() === '') {
      return updatedDrivers;
    } else {
      const query = searchQuery.toLowerCase().trim();
      return updatedDrivers.filter(driver =>
        driver.name.toLowerCase().includes(query) ||
        driver.driver_type?.toLowerCase().includes(query)
      );
    }
  }, [searchQuery, updatedDrivers]);

  const handleDriverPress = (driver: Driver) => {
    // Show driver profile with option to chat
    navigation.navigate('UserProfile', {
      userId: driver.id,
      userName: driver.name,
      isDriver: true,
      isOnline: driver.is_online,
      canChat: true
    });
  };

  const handleChatPress = useCallback((driver: Driver) => {
    console.log('🚀 DriversListScreen: Starting navigation to Chat with driver:', {
      driverId: driver.id,
      driverName: driver.name,
      isOnline: driver.is_online
    });

    try {
      const params = {
        driverId: driver.id,
        driverName: driver.name,
        chatId: undefined, // Set to undefined for new chats, will be determined by ChatScreen
        isOnline: driver.is_online
      };

      // Navigate to the Chat screen using navigationRef (root navigator)
      navigationRef.current?.navigate('Chat', params);
      console.log('✅ DriversListScreen: Navigation successful');
    } catch (error) {
      console.error('❌ DriversListScreen: Chat navigation error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Chat feature is not available right now',
        position: 'bottom',
      });
    }
  }, []);

  const getLastSeenText = (driver: Driver) => {
    if (driver.is_online) {
      return 'Online';
    }
    if (!driver.last_seen) {
      return 'Never';
    }
    return formatDistanceToNow(new Date(driver.last_seen), { addSuffix: true });
  };

  const renderDriver = ({ item: driver }: { item: Driver }) => {
    console.log('🎨 DriversListScreen: Rendering driver:', {
      id: driver.id,
      name: driver.name,
      is_online: driver.is_online,
      last_seen: driver.last_seen,
      shouldShowGreen: driver.is_online
    });

    return (
      <Surface style={styles.driverCard}>
        <TouchableOpacity onPress={() => handleDriverPress(driver)} style={styles.driverContent}>
          <View style={styles.driverInfo}>
            <View style={styles.avatarContainer}>
              {driver.avatar_url ? (
                <Avatar.Image size={50} source={{ uri: driver.avatar_url }} />
              ) : (
                <Avatar.Text size={50} label={driver.name.substring(0, 2).toUpperCase()} />
              )}
              <View style={[styles.onlineIndicator, { backgroundColor: driver.is_online ? '#4CAF50' : '#757575' }]} />
            </View>
            <View style={styles.driverDetails}>
              <Text variant="titleMedium" style={styles.driverName}>{driver.name}</Text>
              <Text variant="bodySmall" style={[styles.lastSeen, { color: driver.is_online ? '#4CAF50' : '#666' }]}>
                {getLastSeenText(driver)}
              </Text>
              {driver.driver_type && (
                <Text variant="bodySmall" style={styles.driverType}>
                  {driver.driver_type}
                </Text>
              )}
              {driver.rating && (
                <View style={styles.statsRow}>
                  <Text variant="bodySmall" style={styles.rating}>
                    ★ {driver.rating.toFixed(1)}
                  </Text>
                  <Text variant="bodySmall" style={styles.jobStats}>
                    {driver.completed_jobs}/{driver.total_jobs} jobs
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.actionButtons}>
            <IconButton
              icon="message"
              size={24}
              iconColor="#6949FF"
              onPress={() => handleChatPress(driver)}
            />
            <IconButton
              icon="chevron-right"
              size={24}
              iconColor="#666"
            />
          </View>
        </TouchableOpacity>
      </Surface>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={['#DAF2FB', '#4083FF']}
          style={styles.container}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6949FF" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={['#DAF2FB', '#4083FF']}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Available Drivers</Text>
          </View>
          <Searchbar
            placeholder="Search drivers..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            iconColor="#666"
          />
        </View>

        <FlatList
          data={filteredDrivers}
          renderItem={renderDriver}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6949FF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {error ? 'Error loading drivers' : 'No drivers found'}
              </Text>
              {error && (
                <TouchableOpacity onPress={onRefresh}>
                  <Text style={styles.retryText}>Tap to retry</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={<Copyright />}
          ListFooterComponentStyle={styles.footer}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6949FF',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchBar: {
    marginTop: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  driverCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#fff',
  },
  driverContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontWeight: '600',
    color: '#333',
  },
  lastSeen: {
    marginTop: 2,
  },
  driverType: {
    marginTop: 4,
    color: '#666',
  },
  footer: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  retryText: {
    fontSize: 14,
    color: '#fff',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    marginRight: 8,
  },
  jobStats: {
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}); 