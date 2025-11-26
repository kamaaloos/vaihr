import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Card, Text, Avatar, Chip, SegmentedButtons, IconButton, Badge, Button, Menu } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import type { Job } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openMaps } from '../utils/maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import Copyright from '../components/Copyright';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { startOnlineStatusTracking } from '../utils/onlineStatus';
import Toast from 'react-native-toast-message';
import { sendPushNotification } from '../utils/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: any;
};

type UserData = {
  name: string;
  profileImage: string | null;
  role?: 'admin' | 'driver';
  expoPushToken?: string;
};

export default function DriverHomeScreen({ navigation, route }: Props) {
  const { user, userData, signOut, updateUserData } = useAuth();
  const { isDarkMode } = useTheme();
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'open' | 'assigned' | 'in_progress' | 'completed'>('open');
  const filterRef = useRef<'open' | 'assigned' | 'in_progress' | 'completed'>(filter);
  const userRef = useRef(user);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);
  
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [refreshingInvoices, setRefreshingInvoices] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);

  // Handle filter changes from navigation
  useEffect(() => {
    if (route.params?.filter) {
      setFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  // Load jobs function - extracted so it can be called from multiple places
  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);

      console.log('Starting loadJobs with user ID:', user.id, 'filter:', filter);

      let query = supabase
        .from('jobs_with_admin')
        .select('*')
        .order('date', { ascending: true });

      // Status-based filtering
      if (filter === 'open') {
        console.log('Applying OPEN filter - showing all open jobs');
        query = query
          .eq('status', 'open')
          .is('driver_id', null);
      } else if (filter === 'assigned') {
        console.log('Applying ASSIGNED filter with driver ID:', user.id);
        query = query
          .eq('status', 'assigned')
          .eq('driver_id', user.id);
      } else if (filter === 'in_progress') {
        console.log('Applying IN_PROGRESS filter with driver ID:', user.id);
        query = query
          .eq('status', 'in_progress')
          .eq('driver_id', user.id);
      } else if (filter === 'completed') {
        console.log('Applying COMPLETED filter with driver ID:', user.id);
        query = query
          .eq('status', 'completed')
          .eq('driver_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching jobs:', error);
        throw error;
      }

      if (!data) {
        setJobs([]);
        return;
      }

      // Transform the data to match the Job interface
      const transformedData = (data as unknown as Job[]);

      // Log the actual jobs data for debugging
      console.log('Fetched jobs data:', {
        total: transformedData.length,
        openJobs: transformedData.filter(j => j.status === 'open' && !j.driver_id).length,
        assignedJobs: transformedData.filter(j => j.status === 'assigned' && j.driver_id === user.id).length,
        inProgressJobs: transformedData.filter(j => j.status === 'in_progress' && j.driver_id === user.id).length,
        completedJobs: transformedData.filter(j => j.status === 'completed' && j.driver_id === user.id).length,
        sample: transformedData[0]
      });

      setJobs(transformedData);

    } catch (error: any) {
      console.error('Error in loadJobs:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, user?.id]);

  // Load jobs when filter changes
  useEffect(() => {
    if (!user?.id) return;
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to job updates with intelligent handling
    const jobsChannel = supabase.channel('driver_jobs_' + user.id)
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
            
            setJobs(currentJobs => {
              // Get current filter and user from refs to ensure latest values
              const currentFilter = filterRef.current;
              const currentUserId = userRef.current?.id;
              
              const isOpenJob = newJob.status === 'open' && !newJob.driver_id;
              const matchesCurrentFilter = 
                (currentFilter === 'open' && isOpenJob) ||
                (currentFilter === 'assigned' && newJob.status === 'assigned' && newJob.driver_id === currentUserId) ||
                (currentFilter === 'in_progress' && newJob.status === 'in_progress' && newJob.driver_id === currentUserId) ||
                (currentFilter === 'completed' && newJob.status === 'completed' && newJob.driver_id === currentUserId);

              console.log('DriverHomeScreen: New job INSERT received:', {
                jobId: newJob.id,
                status: newJob.status,
                driver_id: newJob.driver_id,
                currentFilter,
                currentUserId,
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
                  console.log('DriverHomeScreen: Added new job to list, total jobs:', updated.length);
                  return updated;
                }
              } else {
                console.log('DriverHomeScreen: New job does not match current filter, skipping');
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

            console.log('DriverHomeScreen: Job UPDATE received:', {
              jobId: updatedJob.id,
              oldStatus,
              newStatus,
              driver_id: updatedJob.driver_id,
              currentFilter: filterRef.current
            });

            setJobs(currentJobs => {
              const jobIndex = currentJobs.findIndex(job => job.id === updatedJob.id);
              // Get current filter and user from refs to ensure latest values
              const currentFilter = filterRef.current;
              const currentUserId = userRef.current?.id;
              
              const matchesCurrentFilter = 
                (currentFilter === 'open' && updatedJob.status === 'open' && !updatedJob.driver_id) ||
                (currentFilter === 'assigned' && updatedJob.status === 'assigned' && updatedJob.driver_id === currentUserId) ||
                (currentFilter === 'in_progress' && updatedJob.status === 'in_progress' && updatedJob.driver_id === currentUserId) ||
                (currentFilter === 'completed' && updatedJob.status === 'completed' && updatedJob.driver_id === currentUserId);

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
                  console.log('DriverHomeScreen: Updated job in list');
                  return sorted;
                } else {
                  // Job no longer matches filter - remove it
                  console.log('DriverHomeScreen: Job no longer matches filter, removing from list');
                  return currentJobs.filter(job => job.id !== updatedJob.id);
                }
              } else {
                // Job not in current list but now matches filter - add it
                if (matchesCurrentFilter) {
                  console.log('DriverHomeScreen: Job now matches filter, adding to list');
                  return [updatedJob, ...currentJobs].sort((a, b) => {
                    const dateA = new Date(a.date || a.created_at || 0).getTime();
                    const dateB = new Date(b.date || b.created_at || 0).getTime();
                    return dateA - dateB;
                  });
                } else {
                  console.log('DriverHomeScreen: Updated job does not match current filter, skipping');
                }
              }
              return currentJobs;
            });
          }
        } else if (payload.eventType === 'DELETE') {
          // Remove deleted jobs
          console.log('DriverHomeScreen: Job DELETE received:', payload.old.id);
          setJobs(currentJobs =>
            currentJobs.filter(job => job.id !== payload.old.id)
          );
        }
      })
      .subscribe();

    // Create a channel for notifications (real-time updates)
    const notificationsChannel = supabase
      .channel('notifications_' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        console.log('DriverHomeScreen: New notification received via real-time:', payload);
        setUnreadNotifications(prev => prev + 1);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // If notification was marked as read, decrement count
        if (payload.new.read === true && payload.old.read === false) {
          console.log('DriverHomeScreen: Notification marked as read, decrementing count');
          setUnreadNotifications(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe();

    return () => {
      console.log('Cleaning up subscriptions');
      jobsChannel.unsubscribe();
      notificationsChannel.unsubscribe();
    };
  }, [user?.id, userData?.expoPushToken]);

  useEffect(() => {
    if (!user?.id) return;

    // Reset avatar error when profile image changes
    setAvatarImageError(false);

    // Don't fetch if we already have complete user data
    if (userData?.name && userData?.profileImage !== undefined) {
      return;
    }

    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name, profile_image')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
          return;
        }

        if (data) {
          // Only update if the data is different from current userData
          const newUserData = {
            name: data.name,
            profileImage: data.profile_image
          };

          // Check if data is actually different to prevent unnecessary updates
          if (userData?.name !== newUserData.name || userData?.profileImage !== newUserData.profileImage) {
            updateUserData(newUserData);
          }
        }
      } catch (error) {
        console.error('Error in fetchUserData:', error);
      }
    };

    fetchUserData();
  }, [user?.id, userData?.name, userData?.profileImage]); // Added userData dependencies

  // Add online status tracking
  useEffect(() => {
    if (!user?.id) return;
    const cleanup = startOnlineStatusTracking(user.id);
    return () => cleanup();
  }, [user?.id]);

  // Fetch initial unread notification count and subscribe to changes
  useEffect(() => {
    if (!user?.id) return;

    // Fetch initial unread notification count
    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        if (error) {
          console.error('Error fetching unread notification count:', error);
          return;
        }

        console.log('DriverHomeScreen: Initial unread notification count:', count);
        setUnreadNotifications(count || 0);
      } catch (error) {
        console.error('Error in fetchUnreadCount:', error);
      }
    };

    fetchUnreadCount();

    // Subscribe to push notifications (for incrementing count)
    const pushSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('DriverHomeScreen: Push notification received, incrementing count');
      setUnreadNotifications(prev => prev + 1);
    });

    return () => {
      pushSubscription.remove();
    };
  }, [user?.id]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
  }, [loadJobs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#4CAF50';
      case 'assigned': return '#2196F3';
      case 'in_progress': return '#FFC107';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  const renderJob = ({ item }: { item: Job }) => (
    <Card style={[styles.card, { backgroundColor: surfaceColors.surface }]} mode="elevated">
      <Card.Cover
        source={item.image_url ? { uri: item.image_url } : require('../assets/taxi.png')}
        style={styles.cardImage}
      />
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text variant="titleLarge" style={[styles.title, { color: surfaceColors.text }]}>{item.title}</Text>
            <Chip
              icon="clock"
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white' }}
            >
              {item.status.toUpperCase()}
            </Chip>
          </View>
        </View>

        <Text variant="bodyMedium" style={[styles.description, { color: surfaceColors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.details}>
          <Chip
            icon="map-marker"
            style={[styles.chip, styles.locationChip, { backgroundColor: isDarkMode ? '#1e3a5f' : '#e3f2fd' }]}
            textStyle={{ color: isDarkMode ? '#90CAF9' : '#1976D2' }}
            onPress={() => openMaps(item.location)}
          >
            {item.location}
          </Chip>
          <Chip 
            icon="calendar" 
            style={[styles.chip, { backgroundColor: isDarkMode ? surfaceColors.border : '#f0f0f0' }]}
            textStyle={{ color: surfaceColors.text }}
          >
            {item.date}
          </Chip>
          <Chip 
            icon="currency-eur" 
            style={[styles.chip, { backgroundColor: isDarkMode ? surfaceColors.border : '#f0f0f0' }]}
            textStyle={{ color: surfaceColors.text }}
          >
            {item.rate}/h
          </Chip>
          <Chip 
            icon="clock-outline" 
            style={[styles.chip, { backgroundColor: isDarkMode ? surfaceColors.border : '#f0f0f0' }]}
            textStyle={{ color: surfaceColors.text }}
          >
            {item.duration}
          </Chip>
          {item.status === 'processing' && (
            <Chip
              icon="account"
              style={[styles.chip, styles.driverChip, { backgroundColor: isDarkMode ? '#2d5a3d' : '#E8F5E9' }]}
              textStyle={{ color: isDarkMode ? '#81C784' : '#2E7D32' }}
            >
              You are working on this job
            </Chip>
          )}
          {item.status === 'completed' && (
            <Chip
              icon="check-circle"
              style={[styles.chip, styles.completedChip, { backgroundColor: isDarkMode ? '#2d5a3d' : '#E8F5E9' }]}
              textStyle={{ color: isDarkMode ? '#81C784' : '#2E7D32' }}
            >
              Completed by you
            </Chip>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
            style={styles.viewButton}
          >
            View Details
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const handleNotificationPress = async () => {
    // Fetch current unread count before navigating (don't reset to 0, let NotificationsScreen handle it)
    if (user?.id) {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);
        
        setUnreadNotifications(count || 0);
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    }
    // @ts-ignore - TODO: Add Notifications to RootStackParamList
    navigation.navigate('Notifications');
  };

  const handleLogout = async () => {
    try {
      console.log('DriverHomeScreen: Starting logout process');
      await signOut();
      console.log('DriverHomeScreen: Logout completed successfully');
    } catch (error) {
      console.error('DriverHomeScreen: Error during logout:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please try again',
        position: 'bottom',
      });
    }
  };

  const acceptJob = async (jobId: string) => {
    try {
      if (!user?.id) {
        console.error('No user ID available');
        return;
      }

      // First, get the job details from the view
      const { data: jobData, error: fetchError } = await supabase
        .from('jobs_with_admin')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError) {
        console.error('Error fetching job:', fetchError);
        throw fetchError;
      }

      if (!jobData) {
        console.error('Job not found');
        return;
      }

      // Determine driver name with better fallback logic
      const driverName = userData?.name || user?.email || 'Unknown Driver';
      console.log('DriverHomeScreen - Calculated driver name:', driverName);

      // Update the job status
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          driver_id: user.id,
          driver_name: driverName,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('Error updating job:', updateError);
        throw updateError;
      }

      // Update local state
      setJobs(currentJobs =>
        currentJobs.map(job =>
          job.id === jobId
            ? {
              ...job,
              status: 'assigned',
              driver_id: user.id,
              driver_name: driverName
            }
            : job
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Job accepted successfully',
      });
    } catch (error) {
      console.error('Error accepting job:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to accept job',
      });
    }
  };

  const completeJob = async (jobId: string) => {
    try {
      if (!user?.id) {
        console.log('No user ID available');
        return;
      }

      console.log('Starting job completion for job ID:', jobId);

      // First, get the job details to calculate the amount
      const { data: jobData, error: jobError } = await supabase
        .from('jobs_with_admin')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('Error fetching job details:', jobError);
        throw jobError;
      }

      if (!jobData) {
        console.error('Job not found');
        throw new Error('Job not found');
      }

      console.log('Job data:', jobData);

      // Calculate the amount based on rate and duration
      const amount = parseFloat(jobData.rate) * parseFloat(jobData.duration);
      console.log('Calculated amount:', amount);

      // Update the job status to completed
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', jobId);

      if (updateError) {
        console.error('Error updating job status:', updateError);
        throw updateError;
      }

      console.log('Job status updated to completed');

      // Create the invoice
      const invoiceData = {
        job_id: jobId,
        driver_id: user.id,
        admin_id: jobData.admin_id,
        amount: amount,
        status: 'pending',
        date: new Date().toISOString()
      };

      console.log('Creating invoice with data:', invoiceData);

      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw invoiceError;
      }

      console.log('Invoice created successfully:', createdInvoice);

      // Create notification for admin about invoice creation
      try {
        const driverName = userData?.name || user?.email || 'Driver';
        const invoiceNumber = createdInvoice.invoice_number || 'N/A';
        const notificationMessage = `Invoice ${invoiceNumber} generated for job "${jobData.title}" completed by ${driverName} (€${amount.toFixed(2)})`;

        // Try inserting with data field first
        let notificationPayload: any = {
          user_id: jobData.admin_id,
          title: 'Invoice Generated',
          message: notificationMessage,
          type: 'invoice_creation',
          created_at: new Date().toISOString()
        };

        // Try to add data field, but handle if column doesn't exist
        try {
          notificationPayload.data = {
            invoiceId: createdInvoice.id,
            invoiceNumber: invoiceNumber,
            jobId: jobId,
            jobTitle: jobData.title,
            driverId: user.id,
            driverName: driverName,
            amount: amount
          };
        } catch (e) {
          // If data field can't be added, continue without it
          console.warn('Could not add data field to notification payload');
        }

        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notificationPayload);

        if (notificationError) {
          // If error is about missing data column, try without it
          if (notificationError.message?.includes("'data' column") || notificationError.code === 'PGRST204') {
            console.warn('Data column not found, retrying without data field');
            const { error: retryError } = await supabase
              .from('notifications')
              .insert({
                user_id: jobData.admin_id,
                title: 'Invoice Generated',
                message: notificationMessage,
                type: 'invoice_creation',
                created_at: new Date().toISOString()
              });
            
            if (retryError) {
              console.error('Error creating invoice notification (retry):', retryError);
            } else {
              console.log('Invoice notification created successfully for admin (without data field)');
            }
          } else {
            console.error('Error creating invoice notification:', notificationError);
          }
          // Don't fail the job completion if notification fails
        } else {
          console.log('Invoice notification created successfully for admin');
        }
      } catch (notificationErr) {
        console.error('Error creating invoice notification:', notificationErr);
        // Don't fail the job completion if notification fails
      }

      // Update local state
      setJobs(currentJobs =>
        currentJobs.map(job =>
          job.id === jobId ? { ...job, status: 'completed' } : job
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Job completed successfully',
      });
    } catch (error) {
      console.error('Error completing job:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to complete job',
      });
    }
  };

  const cancelJob = async (jobId: string) => {
    // Implementation for canceling a job
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={gradientColors}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text variant="titleMedium" style={[styles.greeting, { color: surfaceColors.text }]}>Welcome back,</Text>
              <Text variant="headlineSmall" style={[styles.name, { color: surfaceColors.text }]}>{userData?.name || 'Driver'}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.notificationContainer}>
                <IconButton
                  icon="bell"
                  size={24}
                  onPress={handleNotificationPress}
                  style={styles.notificationIcon}
                />
                {unreadNotifications > 0 && (
                  <Badge size={16} style={styles.notificationBadge}>
                    {unreadNotifications}
                  </Badge>
                )}
              </View>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  (() => {
                    const imageUrl = userData?.profileImage || userData?.profile_image;
                    const isValidUrl = imageUrl && 
                      typeof imageUrl === 'string' && 
                      imageUrl.trim() !== '' &&
                      (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
                    
                    // If image error occurred or URL is invalid, show text avatar
                    if (avatarImageError || !isValidUrl) {
                      return (
                        <Avatar.Text
                          size={40}
                          label={userData?.name?.split(' ').map((n: string) => n[0]).join('') || 'D'}
                          style={styles.avatar}
                          onTouchEnd={() => setMenuVisible(true)}
                        />
                      );
                    }
                    
                    // Try to show image avatar
                    return (
                      <Avatar.Image
                        size={40}
                        source={{ uri: imageUrl.trim() }}
                        style={styles.avatar}
                        onTouchEnd={() => setMenuVisible(true)}
                        onError={(error) => {
                          // Silently handle error and fall back to text avatar
                          console.warn('DriverHomeScreen: Avatar image failed to load, using text avatar:', {
                            url: imageUrl,
                            error: error?.nativeEvent?.error || 'Unknown error'
                          });
                          setAvatarImageError(true);
                        }}
                        onLoad={() => {
                          // Reset error state on successful load
                          setAvatarImageError(false);
                        }}
                      />
                    );
                  })()
                }
              >
                <Menu.Item
                  onPress={() => navigation.navigate('Profile')}
                  title="Profile"
                  leadingIcon="account"
                  contentStyle={styles.menuItem}
                />
                <Menu.Item
                  onPress={handleLogout}
                  title="Logout"
                  leadingIcon="logout"
                  contentStyle={styles.menuItem}
                  titleStyle={styles.menuItemText}
                />
              </Menu>
            </View>
          </View>

          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              <SegmentedButtons
                value={filter}
                onValueChange={value => setFilter(value as typeof filter)}
                buttons={[
                  { value: 'open', label: 'Open' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' }
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
            keyExtractor={item => item.id}
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
                <Text style={[styles.emptyText, { color: surfaceColors.textSecondary }]}>No {filter} jobs at the moment</Text>
              </View>
            }
            ListFooterComponent={<Copyright />}
            ListFooterComponentStyle={styles.footer}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            initialNumToRender={5}
          />
        </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    backgroundColor: 'white',
    margin: 0,
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationIcon: {
    backgroundColor: 'white',
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4500',
    borderRadius: 16,
  },
  greeting: {
    color: '#666',
  },
  name: {
    color: '#333',
    fontWeight: 'bold',
  },
  avatar: {
    backgroundColor: '#6949FF',
    marginLeft: 4,
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
    paddingTop: 0,
  },
  footer: {
    marginTop: 16,
    marginBottom: 8,
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
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#333',
    fontWeight: 'bold',
  },
  statusChip: {
    marginLeft: 8,
  },
  description: {
    color: '#666',
    marginBottom: 16,
  },
  details: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
  viewButton: {
    marginLeft: 8,
  },
  menuItem: {
    height: 48,
  },
  menuItemText: {
    color: '#FF4444',
  },
  driverChip: {
    backgroundColor: '#FFC107',
    marginTop: 8,
  },
  completedChip: {
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
}); 