import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, HelperText, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Job, RootStackParamList } from '../types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { DatePickerInput, registerTranslation, en, enGB } from 'react-native-paper-dates';
import Copyright from '../components/Copyright';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendPushNotification } from '../utils/notifications';
import { s, vs, ms } from '../utils/dimensions';
import ErrorBoundary from '../components/ErrorBoundary';
import { convertToUUID } from '../utils/uuid';

// Register translations for date picker
registerTranslation('en', en);
registerTranslation('en-GB', enGB);

type AddJobScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddJob'>;

interface JobData extends Omit<Job, 'id'> {
  admin_name?: string;
  admin_avatar_url?: string;
  driver_count?: number;
  views?: number;
  rate: string;
}

// Taxi image filenames in the Taxis bucket
const TAXI_IMAGE_NAMES = [
  { id: 'default', filename: 'taxi.png', label: 'Default Taxi' },
  { id: 'luxery', filename: 'luxery.png', label: 'Luxury Taxi' },
  { id: 'handicap', filename: 'van.png', label: 'Van Taxi' },
  { id: 'taxi2', filename: 'handicap.png', label: 'Electric Taxi' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FORM_PADDING = SCREEN_WIDTH < 380 ? 12 : 16;
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.2;

export default function AddJobScreen() {
  const navigation = useNavigation<AddJobScreenNavigationProp>();
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [taxiImages, setTaxiImages] = useState<Array<{ id: string; url: { uri: string }; label: string }>>([]);
  const [selectedImage, setSelectedImage] = useState<{ id: string; url: { uri: string }; label: string } | null>(null);
  const [inputDate, setInputDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState<Partial<JobData>>({
    title: '',
    description: '',
    location: '',
    rate: '',
    duration: '',
    status: 'open',
    admin_id: user?.id || '',
    image_url: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [driverCount, setDriverCount] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(true);

  // Load taxi images from Taxis bucket
  useEffect(() => {
    const loadTaxiImages = async () => {
      try {
        setImagesLoading(true);
        const loadedImages: Array<{ id: string; url: { uri: string }; label: string }> = [];

        for (const imageInfo of TAXI_IMAGE_NAMES) {
          try {
            const { data } = supabase.storage
              .from('Taxis')
              .getPublicUrl(imageInfo.filename);

            if (data?.publicUrl) {
              loadedImages.push({
                id: imageInfo.id,
                url: { uri: data.publicUrl },
                label: imageInfo.label
              });
            } else {
              console.warn(`Image not found in Taxis bucket: ${imageInfo.filename}`);
            }
          } catch (error) {
            console.error(`Error loading image ${imageInfo.filename}:`, error);
          }
        }

        if (loadedImages.length > 0) {
          setTaxiImages(loadedImages);
          setSelectedImage(loadedImages[0]);
          setFormData(prev => ({
            ...prev,
            image_url: loadedImages[0].url.uri
          }));
        } else {
          console.error('No taxi images found in Taxis bucket');
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load taxi images from storage',
            position: 'bottom',
          });
        }
      } catch (error) {
        console.error('Error loading taxi images:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load taxi images',
          position: 'bottom',
        });
      } finally {
        setImagesLoading(false);
      }
    };

    loadTaxiImages();
  }, []);

  // Subscribe to job updates, notifications, and driver availability
  useEffect(() => {
    if (!user) return;

    const channels = [
      supabase.channel('jobs')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `admin_id=eq.${user.id}`
        }, async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newJob = payload.new as Job;
            console.log('\n=== NEW JOB CREATED ===');
            console.log('Job Details:', {
              id: newJob.id,
              title: newJob.title,
              status: newJob.status,
              location: newJob.location,
              rate: newJob.rate
            });

            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Job created successfully!',
              position: 'bottom',
            });
            navigation.goBack();
          }
        }),

      supabase.channel('online_drivers')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_status',
          filter: `is_online=eq.true`
        }, async () => {
          // Re-fetch online driver count when status changes
          const { data: statusData, error: statusError } = await supabase
            .from('user_status')
            .select('user_id')
            .eq('is_online', true);

          if (statusError || !statusData || statusData.length === 0) {
            setDriverCount(0);
            return;
          }

          const onlineUserIds = statusData.map(s => s.user_id);
          const { count, error: countError } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'driver')
            .in('id', onlineUserIds);

          if (countError) {
            console.error('Error counting online drivers:', countError);
            setDriverCount(0);
          } else {
            setDriverCount(count || 0);
          }
        })
    ];

    // Subscribe to all channels
    Promise.all(channels.map(channel => channel.subscribe()));

    // Initial driver count - get online drivers from user_status table
    const fetchOnlineDriverCount = async () => {
      try {
        // Get all online user IDs from user_status
        const { data: statusData, error: statusError } = await supabase
          .from('user_status')
          .select('user_id')
          .eq('is_online', true);

        if (statusError) {
          console.error('Error fetching online status:', statusError);
          setDriverCount(0);
          return;
        }

        if (!statusData || statusData.length === 0) {
          setDriverCount(0);
          return;
        }

        // Get count of drivers from users table where they are in the online status list
        const onlineUserIds = statusData.map(s => s.user_id);
        const { count, error: countError } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'driver')
          .in('id', onlineUserIds);

        if (countError) {
          console.error('Error counting online drivers:', countError);
          setDriverCount(0);
        } else {
          setDriverCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching online driver count:', error);
        setDriverCount(0);
      }
    };

    fetchOnlineDriverCount();

    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  }, [user, userData, navigation]);

  // Enhanced form validation
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    const title = formData.title?.trim() ?? '';
    const description = formData.description?.trim() ?? '';
    const location = formData.location?.trim() ?? '';
    const rate = formData.rate ?? '';
    const duration = formData.duration?.trim() ?? '';

    console.log('Validating form with values:', {
      title,
      description,
      location,
      rate,
      duration,
      inputDate
    });

    if (!title) {
      console.log('Title validation failed: empty');
      newErrors.title = 'Title is required';
    }

    if (!description) {
      console.log('Description validation failed: empty');
      newErrors.description = 'Description is required';
    } else if (description.length < 20) {
      console.log('Description validation failed: too short');
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (!location) {
      console.log('Location validation failed: empty');
      newErrors.location = 'Location is required';
    }

    if (!inputDate) {
      console.log('Date validation failed: no date selected');
      newErrors.date = 'Date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(inputDate);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        console.log('Date validation failed: past date');
        newErrors.date = 'Date cannot be in the past';
      } else if (selectedDate > new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)) {
        console.log('Date validation failed: too far in future');
        newErrors.date = 'Date cannot be more than 90 days in the future';
      }
    }

    if (!rate) {
      console.log('Rate validation failed: empty');
      newErrors.rate = 'Rate is required';
    } else if (isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
      console.log('Rate validation failed: invalid number');
      newErrors.rate = 'Rate must be a valid positive number';
    } else if (parseFloat(rate) < 10) {
      console.log('Rate validation failed: too low');
      newErrors.rate = 'Minimum rate is €10/h';
    } else if (parseFloat(rate) > 1000) {
      console.log('Rate validation failed: too high');
      newErrors.rate = 'Maximum rate is €1000/h';
    }

    if (!duration) {
      console.log('Duration validation failed: empty');
      newErrors.duration = 'Duration is required';
    } else if (!duration.match(/^\d+\s*(hour|day|week)s?$/i)) {
      console.log('Duration validation failed: invalid format');
      newErrors.duration = 'Invalid duration format (e.g., "2 hours", "3 days", "1 week")';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('Form validation result:', isValid ? 'VALID' : 'INVALID', newErrors);
    return isValid;
  }, [formData, inputDate]);

  // Get image URL from selected taxi image (already in storage)
  const getSelectedImageUrl = () => {
    if (selectedImage) {
      return selectedImage.url.uri;
    }
    // Fallback to first image if none selected
    if (taxiImages.length > 0) {
      return taxiImages[0].url.uri;
    }
    return '';
  };

  // Enhanced submit handler
  const handleSubmit = async () => {
    console.log('Starting job submission...');
    console.log('Current form data:', formData);
    console.log('Selected date:', inputDate);

    if (!validateForm()) {
      const errorFields = Object.keys(errors);
      const errorMessages = errorFields.map(field => `${field}: ${errors[field]}`);
      console.log('Validation failed. Errors:', errorMessages);
      Toast.show({
        type: 'error',
        text1: 'Form Validation Error',
        text2: errorMessages.join(', '),
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    if (!user || !userData) {
      console.log('No user data available');
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'You must be logged in to create a job',
        position: 'bottom',
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Getting image URL...');

      // Get image URL from selected taxi image (already in Taxis bucket)
      const image_url = getSelectedImageUrl();
      console.log('Image URL obtained:', image_url);

      const jobData: JobData = {
        title: formData.title?.trim() ?? '',
        description: formData.description?.trim() ?? '',
        location: formData.location?.trim() ?? '',
        date: inputDate?.toISOString() || new Date().toISOString(),
        rate: formData.rate ?? '',
        duration: formData.duration?.trim() ?? '',
        image_url,
        status: 'open',
        admin_id: user.id,
        admin_name: userData.name,
        admin_avatar_url: userData.avatar_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        driver_count: driverCount,
        views: 0
      };

      console.log('Submitting job data:', jobData);

      let attempts = 0;
      const maxAttempts = 3;
      let lastError: { message?: string; details?: string } | null = null;

      // Check connection first
      /*  try {
         console.log('Checking database connection...');
         const { data: healthCheck, error: healthError } = await supabase
           .from('jobs')
           .select('id')
           .limit(1);
 
         if (healthError) {
           console.error('Database health check failed:', healthError);
           throw new Error('Unable to connect to the database. Please check your connection.');
         }
         console.log('Database connection check passed');
       } catch (error) {
         console.error('Connection check failed:', error);
         Toast.show({
           type: 'error',
           text1: 'Connection Error',
           text2: 'Unable to connect to the server. Please check your internet connection.',
           position: 'bottom',
           visibilityTime: 4000,
         });
         return;
       } */

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Attempt ${attempts} of ${maxAttempts} to create job`);

          // First, get the admin's UUID from the users table
          let adminId;
          try {
            adminId = await convertToUUID(user.id);
          } catch (error) {
            console.error('Error converting admin ID:', error);
            throw new Error('Failed to validate admin credentials');
          }

          if (!adminId) {
            throw new Error('Admin ID not found');
          }

          const { data, error } = await supabase
            .from('jobs')
            .insert([{
              title: jobData.title,
              description: jobData.description,
              location: jobData.location,
              date: jobData.date,
              rate: jobData.rate,
              duration: jobData.duration,
              image_url: jobData.image_url,
              status: jobData.status,
              admin_id: adminId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select();

          if (error) {
            console.error(`Database error on attempt ${attempts}:`, error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });

            if (error.code === '23505') {
              throw new Error('A job with this title already exists. Please use a different title.');
            }

            if (error.code === '23502') {
              throw new Error('Missing required fields. Please check all fields are filled correctly.');
            }

            if (error.code === '42P01') {
              throw new Error('Database table not found. Please contact support.');
            }

            lastError = error;

            if (attempts < maxAttempts) {
              const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
              console.log(`Waiting ${delay}ms before next attempt...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          } else {
            // Success!
            console.log('Job created successfully!', data);
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Job created successfully!',
              position: 'bottom',
            });
            navigation.goBack();
            return;
          }

        } catch (e: unknown) {
          lastError = e as { message?: string; details?: string };
          console.error(`Attempt ${attempts} failed with error:`, e);

          if ((e as Error).message?.includes('title already exists')) {
            throw e; // Re-throw unique constraint error immediately
          }

          if (attempts < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
            console.log(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // If we get here, all attempts failed
      const errorMessage = lastError?.message || lastError?.details || 'Failed to create job after multiple attempts. Please try again.';
      console.error('All attempts failed. Last error:', errorMessage);
      throw new Error(errorMessage);

    } catch (error: any) {
      console.error('Error creating job:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to create job. Please try again.',
        position: 'bottom',
        visibilityTime: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoized form update handler
  const updateFormData = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  // Memoized driver count message
  const driverCountMessage = useMemo(() => {
    if (driverCount === 0) return 'No drivers currently available';
    return `${driverCount} driver${driverCount === 1 ? '' : 's'} currently available`;
  }, [driverCount]);

  const handleRateChange = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const sanitizedText = text.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = sanitizedText.split('.');
    const finalText = parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : sanitizedText;

    setFormData(prev => ({
      ...prev,
      rate: finalText
    }));
  };

  if (!user || !userData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#DAF2FB', '#4083FF']} style={styles.container}>
          <View style={styles.errorContainer}>
            <Text>You must be logged in to create jobs.</Text>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
            >
              Go Back
            </Button>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={['#DAF2FB', '#4083FF']}
          style={styles.container}
        >
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Text variant="headlineMedium" style={styles.title}>Create New Job</Text>
              <Text style={styles.subtitle}>{driverCountMessage}</Text>
              {imagesLoading ? (
                <View style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="small" color="#6949FF" />
                  <Text style={styles.loadingText}>Loading taxi images...</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageSelector}
                >
                  {taxiImages.map((image) => (
                    <TouchableOpacity
                      key={image.id}
                      onPress={() => {
                        setSelectedImage(image);
                        setFormData(prev => ({
                          ...prev,
                          image_url: image.url.uri
                        }));
                      }}
                      style={[
                        styles.imageOption,
                        selectedImage?.id === image.id && styles.selectedImage
                      ]}
                    >
                      <Image source={image.url} style={styles.thumbnailImage} />
                      <Text style={styles.imageLabel}>{image.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

            </View>

            <View style={styles.formContainer}>
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Job Title"
                    value={formData.title}
                    onChangeText={(value) => updateFormData('title', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.title}
                    placeholder="Enter job title"
                    outlineStyle={styles.inputOutline}
                  />
                  {errors.title && <HelperText type="error">{errors.title}</HelperText>}
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Description"
                    value={formData.description}
                    onChangeText={(value) => updateFormData('description', value)}
                    mode="outlined"
                    style={[styles.input, styles.textArea]}
                    error={!!errors.description}
                    placeholder="Enter job description"
                    multiline
                    numberOfLines={4}
                    outlineStyle={styles.inputOutline}
                  />
                  {errors.description && <HelperText type="error">{errors.description}</HelperText>}
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Location"
                    value={formData.location}
                    onChangeText={(value) => updateFormData('location', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.location}
                    placeholder="Enter job location"
                    outlineStyle={styles.inputOutline}
                  />
                  {errors.location && <HelperText type="error">{errors.location}</HelperText>}
                </View>

                <View style={styles.inputGroup}>
                  <DatePickerInput
                    locale="en-GB"
                    label="Date"
                    value={inputDate}
                    onChange={(d: Date | undefined) => setInputDate(d)}
                    inputMode="start"
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.date}
                    validRange={{
                      startDate: new Date(),
                    }}
                    outlineStyle={styles.inputOutline}
                    calendarIcon="calendar"
                    withDateFormatInLabel
                  />
                  {errors.date && <HelperText type="error">{errors.date}</HelperText>}
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Rate (€/h)"
                    value={formData.rate}
                    onChangeText={handleRateChange}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    error={!!errors.rate}
                    style={styles.input}
                  />
                  {errors.rate && (
                    <HelperText type="error" visible={!!errors.rate}>
                      {errors.rate}
                    </HelperText>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Duration"
                    value={formData.duration}
                    onChangeText={(value) => updateFormData('duration', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.duration}
                    placeholder="e.g., 3 days"
                    outlineStyle={styles.inputOutline}
                  />
                  {errors.duration && <HelperText type="error">{errors.duration}</HelperText>}
                </View>

                <View style={styles.inputGroup}>
                  <TextInput
                    label="Image URL (Optional)"
                    value={formData.image_url}
                    onChangeText={(value) => updateFormData('image_url', value)}
                    mode="outlined"
                    style={styles.input}
                    placeholder="Enter image URL"
                    outlineStyle={styles.inputOutline}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Button
                    mode="outlined"
                    onPress={() => navigation.goBack()}
                    style={[styles.button, styles.cancelButton]}
                    labelStyle={styles.cancelButtonLabel}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={loading}
                    style={styles.button}
                    labelStyle={styles.buttonLabel}
                  >
                    Create Job
                  </Button>
                </View>
              </View>
              <Copyright />
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    </ErrorBoundary>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 28,
  },
  imageSelector: {
    marginBottom: s(16),
  },
  imageOption: {
    marginRight: s(12),
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: s(8),
    borderRadius: s(8),
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedImage: {
    borderColor: '#6949FF',
  },
  thumbnailImage: {
    width: s(80),
    height: s(80),
    borderRadius: s(4),
    marginBottom: s(4),
  },
  imageLabel: {
    fontSize: ms(12),
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  form: {
    padding: FORM_PADDING,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
    fontSize: 14,
    height: 56,
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: 'rgba(105, 73, 255, 0.2)',
    borderWidth: 1.5,
  },
  textArea: {
    minHeight: 100,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
    marginBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 2,
  },
  cancelButton: {
    borderColor: '#ff5252',
    borderWidth: 1.5,
  },
  cancelButtonLabel: {
    color: '#ff5252',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 1,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  imageLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
  },
}); 