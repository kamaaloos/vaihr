import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Platform, Dimensions, StatusBar, KeyboardAvoidingView, Alert, ScrollView } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Avatar, IconButton, Card, Text, Button, Chip, SegmentedButtons, Badge, Drawer, Portal, Modal, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';
import { format } from 'date-fns';
import { v4 as isUUID } from 'uuid';
import { SafeAreaView } from 'react-native-safe-area-context';
import Copyright from '../components/Copyright';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { usePresence } from '../hooks/usePresence';
import { NotificationService } from '../services/notificationService';

type AdminScreenNavigationProp = NavigationProp<RootStackParamList>;
type JobStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'all';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  duration: string;
  rate: string;
  status: JobStatus;
  driver_id?: string;
  driver_name?: string;
  driver_avatar_url?: string;
  admin_id: string;
  admin?: {
    name: string;
    email: string;
  };
  image_url?: string;
  created_at: string;
  updated_at: string;
}

interface JobWithAdmin {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  duration: string;
  rate: string;
  status: JobStatus;
  driver_id?: string;
  driver_name?: string;
  admin_id: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  admin_email: string;
  admin_name: string;
  admin_avatar_url: string;
}

const getStatusColor = (status: JobStatus) => {
  switch (status) {
    case 'open':
      return '#4CAF50';
    case 'assigned':
      return '#2196F3';
    case 'in_progress':
      return '#FF9800';
    case 'completed':
      return '#9C27B0';
    case 'cancelled':
      return '#F44336';
    default:
      return '#757575';
  }
};

//Job Card
const JobCard = memo(({ item, onPress, onDriverPress }: {
  item: Job;
  onPress: (jobId: string) => void;
  onDriverPress: (driverId: string, driverName: string) => void;
}) => (
  <Card style={styles.card} mode="elevated">
    <Card.Cover
      source={item.image_url ? { uri: item.image_url } : require('../assets/taxi.png')}
      style={styles.cardImage}
    />
    <Card.Content>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text variant="titleLarge" style={styles.cardTitle}>{item.title}</Text>
          <Chip
            icon="clock"
            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
            textStyle={{ color: 'white' }}
          >
            {item.status.toUpperCase()}
          </Chip>
        </View>
      </View>

      <Text variant="bodyMedium" style={styles.cardDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.cardDetails}>
        <Chip icon="map-marker" style={[styles.chip, styles.locationChip]}>{item.location}</Chip>
        <Chip icon="calendar" style={styles.chip}>{item.date}</Chip>
        <Chip icon="currency-eur" style={styles.chip}>{item.rate}/h</Chip>
        <Chip icon="clock-outline" style={styles.chip}>{item.duration}</Chip>
        {item.driver_name && item.driver_id && (
          <TouchableOpacity
            onPress={() => onDriverPress(item.driver_id!, item.driver_name!)}
            style={styles.driverChipContainer}
          >
            <View style={[styles.chip, styles.driverChip, styles.clickableDriverChip]}>
              <AvatarWithFallback
                size={24}
                imageUrl={item.driver_avatar_url}
                fallbackLabel={item.driver_name.substring(0, 2).toUpperCase()}
                style={styles.driverChipAvatar}
              />
              <Text style={styles.driverChipText}>{item.driver_name}</Text>
            </View>
          </TouchableOpacity>
        )}
        {item.admin?.name && (
          <Chip
            icon="account-tie"
            style={[styles.chip, styles.adminChip]}
          >
            Created by: {item.admin.name}
          </Chip>
        )}
      </View>

      <View style={styles.cardActions}>
        <Button
          mode="contained"
          onPress={() => onPress(item.id)}
          style={styles.cardButton}
        >
          View Details
        </Button>
      </View>
    </Card.Content>
  </Card>
));

// Drawer width & height
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function AdminHomeScreen() {
  const navigation = useNavigation<AdminScreenNavigationProp>();
  const { user, userData, signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobStatus>('all');
  const filterRef = useRef<JobStatus>(filter);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Keep filterRef in sync with filter state
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  // Add presence hook
  usePresence();

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to job changes with intelligent handling
    const jobSubscription = supabase
      .channel('admin_jobs_' + user.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs'
      }, async (payload) => {
        console.log('Job update received:', payload.eventType, payload.new?.id);

        if (payload.eventType === 'INSERT') {
          // New job created - fetch full job data from jobs_with_admin view
          const { data: newJobData, error: fetchError } = await supabase
            .from('jobs_with_admin')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (fetchError) {
            console.error('Error fetching new job:', fetchError);
            return;
          }

          if (newJobData) {
            const newJob = newJobData as Job;
            // Get current filter value using functional update to ensure we have latest filter
            setJobs(currentJobs => {
              // Check filter match with current filter state (use ref to get latest value)
              const currentFilter = filterRef.current;
              const matchesCurrentFilter = currentFilter === 'all' || newJob.status === currentFilter;

              console.log('AdminHomeScreen: New job INSERT received:', {
                jobId: newJob.id,
                status: newJob.status,
                currentFilter,
                matchesFilter: matchesCurrentFilter
              });

              if (matchesCurrentFilter) {
                const exists = currentJobs.some(job => job.id === newJob.id);
                if (!exists) {
                  const updated = [newJob, ...currentJobs].sort((a, b) => {
                    const dateA = new Date(a.date || a.created_at || 0).getTime();
                    const dateB = new Date(b.date || b.created_at || 0).getTime();
                    return dateA - dateB;
                  });
                  console.log('AdminHomeScreen: Added new job to list, total jobs:', updated.length);
                  return updated;
                }
              } else {
                console.log('AdminHomeScreen: New job does not match current filter, skipping');
              }
              return currentJobs;
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          // Job status or details changed - fetch updated job data
          const { data: updatedJobData, error: fetchError } = await supabase
            .from('jobs_with_admin')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (fetchError) {
            console.error('Error fetching updated job:', fetchError);
            return;
          }

          if (updatedJobData) {
            const updatedJob = updatedJobData as Job;
            const oldStatus = payload.old?.status;
            const newStatus = updatedJob.status;

            console.log('AdminHomeScreen: Job UPDATE received:', {
              jobId: updatedJob.id,
              oldStatus,
              newStatus,
              currentFilter: filterRef.current
            });

            setJobs(currentJobs => {
              const jobIndex = currentJobs.findIndex(job => job.id === updatedJob.id);
              const currentFilter = filterRef.current; // Use ref to get latest filter value
              const matchesCurrentFilter = currentFilter === 'all' || updatedJob.status === currentFilter;

              // If job exists in current list
              if (jobIndex !== -1) {
                if (matchesCurrentFilter) {
                  // Update the job in place
                  const updated = [...currentJobs];
                  updated[jobIndex] = updatedJob;
                  const sorted = updated.sort((a, b) => {
                    const dateA = new Date(a.date || a.created_at || 0).getTime();
                    const dateB = new Date(b.date || b.created_at || 0).getTime();
                    return dateA - dateB;
                  });
                  console.log('AdminHomeScreen: Updated job in list');
                  return sorted;
                } else {
                  // Job no longer matches filter - remove it
                  console.log('AdminHomeScreen: Job no longer matches filter, removing from list');
                  return currentJobs.filter(job => job.id !== updatedJob.id);
                }
              } else {
                // Job not in current list but now matches filter - add it
                if (matchesCurrentFilter) {
                  console.log('AdminHomeScreen: Job now matches filter, adding to list');
                  return [updatedJob, ...currentJobs].sort((a, b) => {
                    const dateA = new Date(a.date || a.created_at || 0).getTime();
                    const dateB = new Date(b.date || b.created_at || 0).getTime();
                    return dateA - dateB;
                  });
                } else {
                  console.log('AdminHomeScreen: Updated job does not match current filter, skipping');
                }
              }
              return currentJobs;
            });
          }
        } else if (payload.eventType === 'DELETE') {
          // Remove deleted jobs
          console.log('AdminHomeScreen: Job DELETE received:', payload.old.id);
          setJobs(currentJobs =>
            currentJobs.filter(job => job.id !== payload.old.id)
          );
        }
      })
      .subscribe();

    if (!jobSubscription) {
      console.error('Failed to subscribe to job changes.');
    } else {
      console.log('Successfully subscribed to job changes.');
    }

    // Subscribe to notifications using the new service
    const unsubscribeNotifications = NotificationService.subscribeToNotifications();

    // Subscribe to notification changes to update unread count (INSERT, UPDATE, DELETE)
    const notificationChangesSubscription = supabase
      .channel(`admin_notifications_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        console.log('AdminHomeScreen: Notification change received:', payload.eventType);
        // Refresh unread count when notifications change
        await fetchUnreadNotifications();
      })
      .subscribe();

    // Initial fetch of unread notifications
    fetchUnreadNotifications();

    return () => {
      console.log('Unsubscribing from job changes...');
      jobSubscription.unsubscribe();

      console.log('Unsubscribing from notifications...');
      unsubscribeNotifications();
      notificationChangesSubscription.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    loadJobs();
  }, [filter]);

  const fetchUnreadNotifications = async () => {
    try {
      if (!user?.id) return;

      const count = await NotificationService.getUnreadNotificationCount(user.id);
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      console.log('AdminHomeScreen: Loading jobs with filter:', filter);

      let query = supabase
        .from('jobs_with_admin')
        .select('*')
        .order('date', { ascending: true });

      // Only add the status filter if it's not 'all'
      if (filter !== 'all') {
        query = query.eq('status', filter);
        console.log('AdminHomeScreen: Applied status filter:', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('AdminHomeScreen: Error loading jobs:', error);
        throw error;
      }

      console.log('AdminHomeScreen: Raw data returned:', {
        totalJobs: data?.length || 0,
        filter: filter,
        sampleJob: data?.[0],
        allStatuses: data?.map(job => job.status)
      });

      if (!data) {
        console.log('AdminHomeScreen: No data returned');
        setJobs([]);
        return;
      }

      // Transform the data to match the Job interface
      // Also fetch driver profile images
      const transformedData = await Promise.all(
        (data as unknown as JobWithAdmin[]).map(async (job) => {
          let driverAvatarUrl: string | undefined;
          
          // Fetch driver profile image if driver_id exists
          if (job.driver_id) {
            try {
              const { data: driverData, error: driverError } = await supabase
                .from('users')
                .select('profile_image, avatar_url')
                .eq('id', job.driver_id)
                .single();
              
              if (!driverError && driverData) {
                driverAvatarUrl = driverData.profile_image || driverData.avatar_url || undefined;
              }
            } catch (error) {
              console.error('Error fetching driver avatar:', error);
            }
          }
          
          return {
            ...job,
            driver_id: job.driver_id || undefined,
            driver_avatar_url: driverAvatarUrl,
            admin: {
              name: job.admin_name,
              email: job.admin_email
            }
          } as Job;
        })
      );

      console.log('AdminHomeScreen: Transformed data:', {
        totalJobs: transformedData.length,
        completedJobs: transformedData.filter(job => job.status === 'completed').length,
        allStatuses: transformedData.map(job => job.status)
      });

      setJobs(transformedData);
    } catch (error) {
      console.error('AdminHomeScreen: Error loading jobs:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load jobs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('AdminHomeScreen: Starting logout process');
              await signOut();
              console.log('AdminHomeScreen: Logout completed successfully');
            } catch (error) {
              console.error('AdminHomeScreen: Error during logout:', error);
              Toast.show({
                type: 'error',
                text1: 'Logout Failed',
                text2: 'Please try again',
                position: 'bottom',
              });
            }
          }
        }
      ]
    );
  };

  const handleNotificationPress = async () => {
    // Just navigate to notifications screen
    // Don't mark as read or delete - let user do that in the screen
    navigation.navigate('Notifications');
  };

  const handleJobPress = useCallback((jobId: string) => {
    navigation.navigate('JobDetails', { jobId });
  }, [navigation]);

  const handleDriverPress = useCallback((driverId: string, driverName: string) => {
    navigation.navigate('UserProfile', {
      userId: driverId,
      userName: driverName,
      isDriver: true,
      isOnline: false, // We don't have online status in job data, will be fetched in UserProfile screen
      canChat: true
    });
  }, [navigation]);

  const renderJob = useCallback(({ item }: { item: Job }) => (
    <JobCard item={item} onPress={handleJobPress} onDriverPress={handleDriverPress} />
  ), [handleJobPress, handleDriverPress]);

  const keyExtractor = useCallback((item: Job) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#DAF2FB', '#4083FF']} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <IconButton
                icon="menu"
                size={24}
                onPress={() => setDrawerVisible(true)}
                style={styles.menuButton}
                iconColor="#333"
              />
              <View>
                <Text variant="titleMedium" style={styles.greeting}>Welcome back,</Text>
                <Text variant="headlineSmall" style={styles.name}>{userData?.name || 'Admin'}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.notificationContainer}>
                <IconButton
                  icon="bell"
                  size={24}
                  onPress={handleNotificationPress}
                  style={styles.notificationButton}
                />
                {unreadNotifications > 0 && (
                  <Badge style={styles.notificationBadge}>
                    {unreadNotifications}
                  </Badge>
                )}
              </View>
              {userData?.avatar_url ? (
                <Avatar.Image
                  size={40}
                  source={{ uri: userData.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={40}
                  label={userData?.name?.split(' ').map((n: string) => n[0]).join('') || 'A'}
                  style={styles.avatar}
                />
              )}
            </View>
          </View>

          <Portal>
            <Modal
              visible={drawerVisible}
              onDismiss={() => setDrawerVisible(false)}
              contentContainerStyle={{
                flexGrow: 1, // Prevents taking full screen
                width: '80%', // Use percentage width for responsiveness
                maxWidth: 400, // Limit width on larger screens
                //alignSelf: 'flex-start', // Center on the screen
                backgroundColor: 'transparent',
                borderRadius: 16,
                padding: 12,
                marginTop: Platform.OS === 'ios' ? 30 : 0, // iOS offset
              }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0} // Avoid shrinking space
                style={{ flex: 1 }}
              >
                <SafeAreaView style={{
                  flex: 1,
                  paddingTop: Platform.OS === 'ios' ? StatusBar.currentHeight || 44 : 0
                }}
                  edges={['top', 'bottom']}>
                  <View style={styles.drawer}>
                    <LinearGradient
                      colors={['#6949FF', '#4083FF']}
                      style={styles.drawerHeader}
                    >
                      {userData?.avatar_url ? (
                        <Avatar.Image
                          size={48}
                          source={{ uri: userData.avatar_url }}
                          style={styles.drawerAvatar}
                        />
                      ) : (
                        <Avatar.Text
                          size={48}
                          label={userData?.name?.split(' ').map((n: string) => n[0]).join('') || 'A'}
                          style={styles.drawerAvatar}
                        />
                      )}
                      <Text variant="titleMedium" style={styles.drawerName}>{userData?.name || 'Admin'}</Text>
                      <Text variant="bodyMedium" style={styles.drawerEmail}>{userData?.email}</Text>
                    </LinearGradient>

                    <View style={styles.drawerContent}>
                      <View style={styles.drawerSection}>
                        <TouchableOpacity
                          style={styles.drawerItem}
                          onPress={() => {
                            setDrawerVisible(false);
                            navigation.navigate('DriversList');
                            setTimeout(() => setDrawerVisible(false), 300);
                          }}
                        >
                          <View style={styles.drawerItemIconContainer}>
                            <IconButton icon="account-group" size={24} />
                            <Text variant="labelSmall" style={styles.drawerItemLabel}>Drivers</Text>
                          </View>
                          <Text variant="bodyMedium" style={styles.drawerItemText}>Manage Drivers</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drawerItem}
                          onPress={() => {
                            setDrawerVisible(false);
                            navigation.navigate('Invoice', {});
                          }}
                        >
                          <View style={styles.drawerItemIconContainer}>
                            <IconButton icon="file-document" size={24} />
                            <Text variant="labelSmall" style={styles.drawerItemLabel}>Invoices</Text>
                          </View>
                          <Text variant="bodyMedium" style={styles.drawerItemText}>Billing & Payments</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drawerItem}
                          onPress={() => {
                            setDrawerVisible(false);
                            navigation.navigate('UploadTerms');
                          }}
                        >
                          <View style={styles.drawerItemIconContainer}>
                            <IconButton icon="file-document-edit" size={24} />
                            <Text variant="labelSmall" style={styles.drawerItemLabel}>Terms</Text>
                          </View>
                          <Text variant="bodyMedium" style={styles.drawerItemText}>Terms of Service</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.drawerItem}
                          onPress={() => {
                            setDrawerVisible(false);
                            (navigation as any).navigate('Profile');
                          }}
                        >
                          <View style={styles.drawerItemIconContainer}>
                            <IconButton icon="account" size={24} />
                            <Text variant="labelSmall" style={styles.drawerItemLabel}>Profile</Text>
                          </View>
                          <Text variant="bodyMedium" style={styles.drawerItemText}>Admin Profile</Text>
                        </TouchableOpacity>
                      </View>

                      <Divider style={styles.drawerDivider} />

                      <TouchableOpacity
                        style={[styles.drawerItem, styles.logoutItem]}
                        onPress={async () => {
                          setDrawerVisible(false);
                          await handleLogout();
                        }}
                      >
                        <View style={styles.drawerItemIconContainer}>
                          <IconButton icon="logout" size={20} iconColor="#FF4444" />
                        </View>
                        <Text variant="bodyMedium" style={styles.logoutText}>Sign Out</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </Modal>
          </Portal>

          <Button
            mode="contained"
            icon="plus"
            onPress={() => navigation.navigate('AddJob')}
            style={styles.addButton}
          >
            Add New Job
          </Button>

          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              <SegmentedButtons
                value={filter}
                onValueChange={value => setFilter(value as JobStatus)}
                buttons={[
                  { value: 'all', label: 'All' },
                  { value: 'open', label: 'Open' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                style={styles.filter}
                density="medium"
                theme={{
                  colors: {
                    secondaryContainer: '#f0f0f0',
                    onSecondaryContainer: '#333',
                  }
                }}
              />
            </ScrollView>
          </View>

          <FlatList
            data={jobs}
            renderItem={renderJob}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={loadJobs}
                colors={['#6949FF']}
              />
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text variant="titleMedium">No jobs found</Text>
                <Text variant="bodyMedium">Pull down to refresh</Text>
              </View>
            )}
            ListFooterComponent={<Copyright />}
            ListFooterComponentStyle={styles.footer}
          />
        </View>
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
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationButton: {
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4444',
  },
  avatar: {
    backgroundColor: '#6949FF',
  },
  greeting: {
    color: '#666',
  },
  name: {
    color: '#333',
    fontWeight: 'bold',
  },
  addButton: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#6949FF',
  },
  filterContainer: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  filterScrollContent: {
    paddingHorizontal: 8,
  },
  filter: {
    marginHorizontal: 8,
    marginBottom: 16,
    minWidth: '100%',
  },
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    elevation: 3,
  },
  cardImage: {
    height: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    color: '#333',
    fontWeight: 'bold',
  },
  statusChip: {
    marginLeft: 8,
  },
  cardDescription: {
    color: '#666',
    marginBottom: 16,
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    elevation: 2,
  },
  locationChip: {
    backgroundColor: '#e3f2fd',
  },
  driverChip: {
    backgroundColor: '#FFC107',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  driverChipContainer: {
    marginTop: 8,
  },
  driverChipAvatar: {
    marginRight: 8,
  },
  driverChipText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  clickableDriverChip: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  adminChip: {
    backgroundColor: '#E1BEE7',
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
  cardButton: {
    marginLeft: 8,
  },
  footer: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  drawer: {
    flex: 1,
    backgroundColor: '#fff',
    width: SCREEN_WIDTH * 0.7,
    maxWidth: 400,
    minHeight: Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.8 : 'auto',
  },
  drawerHeader: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: 'center',
  },
  drawerAvatar: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  drawerName: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  drawerEmail: {
    color: '#fff',
    opacity: 0.8,
  },
  drawerContent: {
    flex: 1,
    padding: 14,
  },
  drawerSection: {
    marginBottom: 8,
  },
  drawerItem: {
    flexDirection: 'row',  // Arrange items in a row
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 5,
  },

  drawerItemIconContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginBottom: 1,
  },
  drawerItemLabel: {
    color: '#666',
    textTransform: 'uppercase',
  },
  drawerItemText: {
    marginLeft: 40,
    color: '#333',
    textAlign: 'center',
  },
  drawerDivider: {
    marginVertical: 8,
  },
  logoutItem: {
    backgroundColor: '#FFF5F5',
  },
  logoutLabel: {
    color: '#FF4444',
  },
  logoutText: {
    marginLeft: 40,
    color: '#FF4444',
  },
  menuButton: {
    margin: 0,
  },
}); 