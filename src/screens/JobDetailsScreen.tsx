import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Surface, ActivityIndicator } from 'react-native-paper';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Job } from '../types';
import Toast from 'react-native-toast-message';
import { sendPushNotification } from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { useJobs } from '../contexts/JobsContext';

interface JobWithAdmin extends Omit<Job, 'admin_name' | 'admin_avatar_url'> {
  admin: {
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'JobDetails'>;
  route: {
    params: {
      jobId: string;
    };
  };
};

export default function JobDetailsScreen({ route, navigation }: Props) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { jobId } = route.params;
  const { user, userData } = useAuth();
  const { updateJob } = useJobs();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJob();
    const unsubscribe = subscribeToJobUpdates();
    return () => unsubscribe();
  }, [jobId]);

  const subscribeToJobUpdates = () => {
    const subscription = supabase
      .channel(`job:${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setJob(payload.new as Job);
        } else if (payload.eventType === 'DELETE') {
          navigation.goBack();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs_with_admin')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      if (!data) {
        setError('Job not found');
        return;
      }

      // Transform the data to match the Job interface
      const transformedData = {
        ...data,
        driver_id: data.driver_id || undefined,
        admin: {
          name: data.admin_name,
          email: data.admin_email
        }
      } as Job;

      setJob(transformedData);
    } catch (error) {
      console.error('Error fetching job:', error);
      setError('Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptJob = async () => {
    try {
      // Get current user data
      if (!userData || !job) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Cannot accept job: Invalid user or job data',
        });
        return;
      }

      setLoading(true);

      // Debug logging
      console.log('=== JOB ASSIGNMENT DEBUG ===');
      console.log('Job ID:', job.id);
      console.log('User ID (auth):', user?.id);
      console.log('UserData ID (db):', userData?.id);
      console.log('UserData object:', userData);
      console.log('UserData name:', userData?.name);
      console.log('UserData name type:', typeof userData?.name);
      console.log('User email:', user?.email);
      console.log('Job status before:', job.status);
      console.log('Job driver_id before:', job.driver_id);

      // Check if user is available
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Determine driver name with better fallback logic
      const driverName = userData?.name || user?.email || 'Unknown Driver';
      console.log('Calculated driver name:', driverName);

      // Update and return the updated row to avoid stale state
      const { data: updatedRow, error: updateError } = await supabase
        .from('jobs')
        .update({
          driver_id: user.id,
          // also persist driver_name to support UIs/views relying on this column
          driver_name: driverName,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .select('*')
        .single();

      console.log('Update error:', updateError, 'Updated row:', updatedRow);
      console.log('=== END DEBUG ===');

      if (updateError) {
        throw updateError;
      }

      // Fetch the updated job data
      const { data: updatedJob, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          *,
          admin:users!admin_id (
            name,
            email,
            avatar_url
          )
        `)
        .eq('id', job.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!updatedJob) {
        throw new Error('No job data returned after update');
      }

      // Transform the data to match the Job interface
      const transformedJob = {
        ...(updatedJob as unknown as JobWithAdmin),
        driver_id: (updatedJob as unknown as JobWithAdmin).driver_id || undefined,
        admin_name: (updatedJob as unknown as JobWithAdmin).admin?.name || (updatedJob as unknown as JobWithAdmin).admin?.email || undefined,
        admin_avatar_url: (updatedJob as unknown as JobWithAdmin).admin?.avatar_url || undefined
      } as Job;

      // Update local state
      setJob(transformedJob);

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Job accepted successfully',
        position: 'bottom',
      });

      // Navigate back to DriverHome with 'assigned' filter
      navigation.navigate('DriverHome', { filter: 'assigned' });
    } catch (error: unknown) {
      console.error('Error accepting job:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to accept job',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };


  const handleDeclineJob = () => {
    Alert.alert(
      'Decline Job',
      'Are you sure you want to decline this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('jobs')
                .update({
                  status: 'open',
                  driver_id: null,
                  driver_name: null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', jobId);

              if (error) throw error;

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Job declined successfully',
                position: 'bottom',
              });

              // Navigate back to DriverHome with 'open' filter
              navigation.navigate('DriverHome', { filter: 'open' });
            } catch (error) {
              console.error('Error declining job:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to decline job',
                position: 'bottom',
              });
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteJob = async () => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteLoading(true);
              const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', jobId);

              if (error) throw error;

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Job deleted successfully',
                position: 'bottom',
              });

              navigation.goBack();
            } catch (error) {
              console.error('Error deleting job:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete job',
                position: 'bottom',
              });
            } finally {
              setDeleteLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCompleteJob = async () => {
    if (!job || !userData) {
      Alert.alert('Error', 'Missing job or user data');
      return;
    }

    // Calculate duration_minutes from duration string
    const durationMatch = job.duration.toLowerCase().match(/^(\d+)\s*(day|days|hour|hours|h|d)s?$/i);
    if (!durationMatch) {
      Alert.alert('Error', 'Invalid duration format');
      return;
    }

    const [, durationValue, unit] = durationMatch;
    const numericDuration = parseFloat(durationValue);
    const durationMinutes = unit.startsWith('d') ? numericDuration * 8 * 60 : numericDuration * 60;

    // Calculate rate_per_hour from rate string
    const rateMatch = job.rate.match(/^(\d+(\.\d+)?)/);
    if (!rateMatch) {
      Alert.alert('Error', 'Invalid rate format');
      return;
    }

    const ratePerHour = parseFloat(rateMatch[1]);

    setLoading(true);
    try {
      // Call the stored procedure with a single JSON parameter
      const { data: invoiceId, error: completeError } = await supabase
        .rpc('complete_job_and_create_invoice', {
          params: {
            job_id: job.id,
            duration_minutes: durationMinutes,
            rate_per_hour: ratePerHour
          }
        });

      if (completeError) {
        throw completeError;
      }

      // Fetch the updated job data
      const { data: updatedJob, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', job.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Fetch the created invoice to get invoice details
      const { data: createdInvoice, error: invoiceFetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Create notification for admin about invoice creation (backup in case trigger fails)
      if (createdInvoice && !invoiceFetchError) {
        try {
          const driverName = userData?.name || user?.email || 'Driver';
          const invoiceNumber = createdInvoice.invoice_number || 'N/A';
          const amount = createdInvoice.amount || (ratePerHour * durationMinutes / 60);
          const notificationMessage = `Invoice ${invoiceNumber} generated for job "${job.title}" completed by ${driverName} (€${amount.toFixed(2)})`;

          // Try inserting with data field first
          let notificationPayload: any = {
            user_id: job.admin_id,
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
              jobId: job.id,
              jobTitle: job.title,
              driverId: user?.id,
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
                  user_id: job.admin_id,
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
      }

      setJob(updatedJob as Job);
      Alert.alert('Success', 'Job completed successfully');
      navigation.navigate('DriverHome', { filter: 'completed' });
    } catch (error: any) {
      console.error('Error completing job:', error);
      Alert.alert('Error', error.message || 'Failed to complete job');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#4CAF50';
      case 'assigned': return '#2196F3';
      case 'in_progress': return '#FFC107';
      case 'completed': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  if (!job) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6949FF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card mode="elevated">
        <Card.Cover
          source={job.image_url ? { uri: job.image_url } : require('../../assets/icon.png')}
        />
        <Card.Content>
          <Title>{job.title}</Title>
          <Chip
            icon="information"
            style={[styles.statusChip, { backgroundColor: getStatusColor(job.status) }]}
          >
            {job.status.toUpperCase()}
          </Chip>

          <Surface style={styles.section}>
            <Title style={styles.sectionTitle}>Job Details</Title>
            <Paragraph style={styles.description}>{job.description}</Paragraph>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Title style={styles.detailLabel}>Location</Title>
                <Paragraph>{job.location}</Paragraph>
              </View>
              <View style={styles.detailItem}>
                <Title style={styles.detailLabel}>Date</Title>
                <Paragraph>{new Date(job.date).toLocaleDateString()}</Paragraph>
              </View>
              <View style={styles.detailItem}>
                <Title style={styles.detailLabel}>Duration</Title>
                <Paragraph>{job.duration}</Paragraph>
              </View>
              <View style={styles.detailItem}>
                <Title style={styles.detailLabel}>Rate</Title>
                <Paragraph>€{job.rate}/h</Paragraph>
              </View>
            </View>
          </Surface>

          {job.status === 'open' && user?.role === 'driver' && (
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleAcceptJob}
                loading={loading}
                disabled={loading}
                style={[styles.button, styles.acceptButton]}
              >
                Accept Job
              </Button>
              <Button
                mode="outlined"
                onPress={handleDeclineJob}
                disabled={loading}
                style={[styles.button, styles.declineButton]}
              >
                Decline
              </Button>
            </View>
          )}

          {job.status === 'assigned' && user?.role === 'driver' && job.driver_id === user.id && (
            <Button
              mode="contained"
              onPress={async () => {
                try {
                  // Update job status to in_progress
                  const { error } = await supabase
                    .from('jobs')
                    .update({
                      status: 'in_progress',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                  if (error) throw error;

                  setJob({ ...job, status: 'in_progress' });
                  Toast.show({
                    type: 'success',
                    text1: 'Job Started',
                    text2: 'You have started working on this job.',
                  });
                } catch (error: any) {
                  console.error('Error starting job:', error);
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to start job',
                  });
                }
              }}
              style={[styles.button, styles.startButton]}
            >
              Start Job
            </Button>
          )}

          {job.status === 'in_progress' && user?.role === 'driver' && job.driver_id === user.id && (
            <Button
              mode="contained"
              onPress={handleCompleteJob}
              style={styles.actionButton}
              loading={loading}
              disabled={loading}
            >
              Complete Job
            </Button>
          )}

          {user?.role === 'admin' && (
            <Button
              mode="contained"
              onPress={handleDeleteJob}
              loading={deleteLoading}
              disabled={deleteLoading}
              style={[styles.button, styles.deleteButton]}
              icon="delete"
            >
              Delete Job
            </Button>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: 16,
  },
  section: {
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  description: {
    marginVertical: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  detailItem: {
    width: '50%',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 8,
  },
  declineButton: {
    flex: 1,
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: '#2196F3',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButton: {
    backgroundColor: '#2196F3',
  },
}); 