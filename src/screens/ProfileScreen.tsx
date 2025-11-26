import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Image, TouchableOpacity } from 'react-native';
import * as FileSystem from "expo-file-system/legacy";
import { Text, Surface, Avatar, Button, Chip, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import Copyright from '../components/Copyright';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';
import { AvatarWithFallback } from '../components/AvatarWithFallback';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type EditableSection = 'company' | 'professional' | 'contact' | 'bank' | 'account' | 'documents' | null;

export default function ProfileScreen() {
  const { user, userData, updateUserData } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { isDarkMode } = useTheme();
  const gradientColors = getGradientColors(isDarkMode);
  const surfaceColors = getSurfaceColors(isDarkMode);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(0); // Force re-render key
  const [accountData, setAccountData] = useState({
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingEmail, setChangingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [documentImages, setDocumentImages] = useState({
    licenseFront: null as { base64: string; uri: string } | null,
    licenseBack: null as { base64: string; uri: string } | null,
    idCardFront: null as { base64: string; uri: string } | null,
    idCardBack: null as { base64: string; uri: string } | null,
  });
  const [uploadingDocuments, setUploadingDocuments] = useState(false);

  useEffect(() => {
    // Set loading to false once userData is available
    if (userData) {
      setLoading(false);
    }
  }, [userData]);

  // Reset image error state when profileImage changes
  useEffect(() => {
    const imageUrl = userData?.profileImage || userData?.profile_image;
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      // Reset error state when image URL changes
      setImageError(false);
      setImageLoading(false);
      console.log('🖼️ Profile image URL detected:', imageUrl);
    } else {
      setImageError(false);
      setImageLoading(false);
    }
  }, [userData?.profileImage, userData?.profile_image]);

  const pickDocumentImage = async (type: 'licenseFront' | 'licenseBack' | 'idCardFront' | 'idCardBack') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "We need access to your photos to upload documents.",
          position: "bottom",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64 && asset.uri) {
          setDocumentImages(prev => ({
            ...prev,
            [type]: { base64: asset.base64, uri: asset.uri },
          }));
        }
      }
    } catch (error) {
      console.error('Error picking document image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
        position: 'bottom',
      });
    }
  };

  const pickImage = async () => {
    try {
      console.log("📷 pickImage called");

      // ✅ Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log("📷 Permission status:", status);

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "We need access to your photos to change your profile picture.",
          position: "bottom",
        });
        return;
      }

      // ✅ Launch image picker
      console.log("📷 Launching image picker...");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, // optional; iOS will use this automatically
      });

      console.log("📷 Image picker result:", {
        canceled: result.canceled,
        hasAssets: !!result.assets?.[0],
        hasBase64: !!result.assets?.[0]?.base64,
        base64Length: result.assets?.[0]?.base64?.length || 0,
        uri: result.assets?.[0]?.uri,
        platform: Platform.OS,
      });

      if (result.canceled || !result.assets?.length) {
        console.log("📷 Image selection canceled or invalid.");
        return;
      }

      const asset = result.assets[0];

      if (Platform.OS === "android") {
        console.log("📷 Android detected — using URI-based upload...");
        await uploadImageFromUri(asset.uri);
      } else if (asset.base64) {
        console.log("📷 iOS detected — uploading from base64...");
        await uploadImageFromUri(asset.uri); // You could create a variant that accepts base64 if you want
      } else {
        console.error("❌ No base64 or URI data found for image asset!");
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to process image. Please try again.",
          position: "bottom",
        });
      }
    } catch (error: any) {
      console.error("❌ Error picking image:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to pick image. Please try again.",
        position: "bottom",
      });
    }
  };

  // Alternative upload method for Android using URI directly
  const uploadImageFromUri = async (uri: string) => {
    if (!user?.id) {
      console.error("❌ No user ID available");
      return;
    }

    setUploadingImage(true);
    const timestamp = Date.now();
    const fileName = `${user.id}-${timestamp}.jpg`;

    try {
      console.log("📤 Reading file for upload...");
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) throw new Error("File does not exist");

      // Get authenticated session token (required for RLS)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Not authenticated. Please log in again.");
      }

      console.log("📤 File exists, creating FormData...");
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: fileName,
        type: "image/jpeg",
      } as any);

      // Use the Supabase Storage REST endpoint with authenticated session token
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/images/${fileName}`;

      console.log("📤 Uploading with authenticated session...");
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`, // Use session token, not anon key
          "x-upsert": "true",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase upload failed: ${response.status} - ${errorText}`);
      }

      console.log("✅ Upload success!");

      const { data: { publicUrl } } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      console.log("📤 Public URL:", publicUrl);

      // Update user's profile_image in database
      const { data: updateData, error: updateError } = await supabase
        .from("users")
        .update({
          profile_image: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("profile_image")
        .single();

      if (updateError) throw updateError;

      console.log("✅ Database updated:", updateData);

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
      updateUserData({
        ...userData,
        profileImage: cacheBustedUrl,
        profile_image: publicUrl,
      });

      console.log("✅ UserData context updated");
      setSelectedImage(null);
      setImageKey((prev) => prev + 1);

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Profile image updated successfully!",
        position: "bottom",
      });
    } catch (error: any) {
      console.error("❌ Upload error:", error);

      let msg = "Failed to upload image. Please try again.";
      if (error.message?.includes("5MB")) msg = error.message;
      if (error.message?.includes("403") || error.message?.includes("Unauthorized") || error.message?.includes("permission")) {
        msg = "Permission denied. Please log in again.";
      }
      if (error.message?.includes("400") || error.message?.includes("invalid")) msg = "Invalid image data.";

      Toast.show({
        type: "error",
        text1: "Upload Failed",
        text2: msg,
        position: "bottom",
      });
      setSelectedImage(null);
    } finally {
      setUploadingImage(false);
      console.log("📤 Upload process finished");
    }
  };

  const uploadImage = async (base64Image: string, imageUri?: string) => {
    if (!user?.id) {
      console.error('❌ No user ID available');
      return;
    }

    console.log('📤 uploadImage called:', {
      hasBase64: !!base64Image,
      base64Length: base64Image?.length || 0,
      hasUri: !!imageUri,
      uri: imageUri || 'none',
      userId: user.id,
      platform: Platform.OS
    });

    setUploadingImage(true);
    try {
      // Generate unique filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileName = `${user.id}-${timestamp}.jpg`;
      console.log('📤 Decoding base64 image...');

      let decodedImage: ArrayBuffer;
      try {
        decodedImage = decode(base64Image);
        const sizeKB = Math.round(decodedImage.byteLength / 1024);
        console.log('📤 Image decoded successfully:', {
          fileName,
          size: decodedImage.byteLength,
          sizeKB
        });

        // Validate image size (max 5MB)
        if (sizeKB > 5120) {
          throw new Error('Image is too large. Please use an image smaller than 5MB.');
        }

        // Validate minimum size (at least 1KB)
        if (sizeKB < 1) {
          throw new Error('Image file is too small or invalid.');
        }
      } catch (decodeError: any) {
        console.error('❌ Error decoding base64:', decodeError);
        if (decodeError.message) {
          throw decodeError;
        }
        throw new Error('Failed to process image data. Please try a different image.');
      }

      // Upload to Supabase storage
      // Try ArrayBuffer first (works on iOS, sometimes on Android)
      console.log('📤 Uploading to Supabase storage...', {
        platform: Platform.OS,
        fileName,
        imageSize: decodedImage.byteLength
      });

      let uploadData;
      let uploadError;

      // On Android, read file from URI using FileSystem and convert to ArrayBuffer
      // This approach works better than using base64 directly from ImagePicker
      // On iOS, ArrayBuffer from decoded base64 works fine
      if (Platform.OS === 'android' && imageUri) {
        console.log('📤 Android detected - reading file from URI using FileSystem...', {
          uri: imageUri,
          fileName
        });
        try {
          // Read file from URI as base64
          console.log('📤 Reading file from', imageUri);
          const base64FromUri = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
          });

          console.log('📤 Converting to ArrayBuffer...');
          const arrayBufferFromUri = decode(base64FromUri);
          const sizeKB = Math.round(arrayBufferFromUri.byteLength / 1024);
          console.log('📤 File read and converted:', {
            fileName,
            size: arrayBufferFromUri.byteLength,
            sizeKB
          });

          // Validate image size
          if (sizeKB > 5120) {
            throw new Error('Image is too large. Please use an image smaller than 5MB.');
          }

          if (sizeKB < 1) {
            throw new Error('Image file is too small or invalid.');
          }

          // Upload to Supabase using ArrayBuffer from FileSystem
          console.log('📤 Uploading to Supabase...');
          const { data, error } = await supabase.storage
            .from('images')
            .upload(fileName, arrayBufferFromUri, {
              contentType: 'image/jpeg',
              upsert: true, // Use upsert to allow overwriting
            });

          if (error) {
            console.error('❌ Supabase upload error:', error);
            throw error;
          }

          console.log('✅ Upload success:', data);
          uploadData = data;
          uploadError = null;
        } catch (uploadErr: any) {
          console.error('❌ Android upload error:', uploadErr);
          uploadError = uploadErr;
          uploadData = null;
        }
      } else {
        // iOS or no URI - use ArrayBuffer from decoded base64 (works fine)
        console.log('📤 Using ArrayBuffer upload (iOS or no URI)...');
        try {
          const { data, error } = await supabase.storage
            .from('images')
            .upload(fileName, decodedImage, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          uploadData = data;
          uploadError = error;

          console.log('📤 ArrayBuffer upload completed:', {
            hasData: !!uploadData,
            hasError: !!uploadError,
            error: uploadError?.message || 'none'
          });
        } catch (uploadErr: any) {
          console.error('❌ ArrayBuffer upload error:', uploadErr);
          uploadError = uploadErr;
          uploadData = null;
        }
      }

      // Handle any remaining errors
      if (uploadError) {
        console.error('❌ Profile image upload error:', {
          error: uploadError,
          message: uploadError.message,
          name: uploadError.name,
          platform: Platform.OS
        });

        // Provide more specific error messages
        if (uploadError.message?.includes('already exists') || uploadError.message?.includes('409')) {
          // If file exists, try with upsert
          console.log('📤 File exists, retrying with upsert...');
          const retryMethod = Platform.OS === 'android' && imageUri
            ? (() => {
              const formData = new FormData();
              formData.append('file', {
                uri: imageUri,
                name: fileName,
                type: 'image/jpeg'
              } as any);
              return formData;
            })()
            : decodedImage;

          const { data: retryData, error: retryError } = await supabase.storage
            .from('images')
            .upload(fileName, retryMethod, {
              ...(Platform.OS === 'android' && imageUri ? {} : { contentType: 'image/jpeg' }),
              upsert: true,
            });

          if (retryError) {
            console.error('❌ Retry upload also failed:', retryError);
            throw new Error(`Failed to upload profile image: ${retryError.message || 'Unknown error'}`);
          }
          uploadData = retryData;
          uploadError = null;
        } else {
          const errorMsg = uploadError.message || 'Unknown error';
          console.error('❌ Upload failed with error:', errorMsg);
          throw new Error(`Failed to upload profile image: ${errorMsg}`);
        }
      }

      console.log('✅ Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      console.log('📤 Public URL generated:', publicUrl);

      // Update user's profile_image in database
      console.log('📤 Updating database...');
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          profile_image: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select('profile_image')
        .single();

      if (updateError) {
        console.error('❌ Error updating profile_image in database:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      console.log('✅ Database updated successfully:', updateData);

      // Verify the update worked
      if (updateData?.profile_image !== publicUrl) {
        console.warn('⚠️ Database update may not have worked. Expected:', publicUrl, 'Got:', updateData?.profile_image);
      }

      // Add cache-busting parameter to force image reload
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      // Update userData in context immediately
      const updatedUserData = {
        ...userData,
        profileImage: cacheBustedUrl,
        profile_image: publicUrl, // Store original URL (without cache-bust) in context
      };
      updateUserData(updatedUserData);
      console.log('✅ UserData context updated with cache-busted URL');

      // Clear selected image
      setSelectedImage(null);

      // Force re-render by updating key
      setImageKey(prev => prev + 1);

      // Don't call onRefresh immediately - it would overwrite our updated userData with cache-bust
      // The image is already updated in the context, so we don't need to refresh
      // The cache-bust parameter will ensure the new image loads
      console.log('✅ Image update complete. UI should show new image with cache-bust parameter.');

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile image updated successfully!',
        position: 'bottom',
      });
    } catch (error: any) {
      console.error('❌ Error uploading profile image:', {
        error,
        message: error?.message || 'Unknown error',
        name: error?.name,
        stack: error?.stack,
        code: error?.code,
        errorCode: error?.error
      });

      // Provide more specific error messages
      let errorMessage = 'Failed to upload image. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code === 'storage_error' || error?.message?.includes('400') || error?.message?.includes('invalid')) {
        errorMessage = 'Storage error: The image file may be invalid or too large. Please try a different image.';
      } else if (error?.code === 'permission_denied' || error?.message?.includes('403') || error?.message?.includes('permission')) {
        errorMessage = 'Permission denied: Unable to upload image. Please check your permissions.';
      }

      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: errorMessage,
        position: 'bottom',
      });

      // Clear selected image on error
      setSelectedImage(null);
    } finally {
      setUploadingImage(false);
      console.log('📤 Upload process finished');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      // Update the user data in the auth context
      // Map database fields (snake_case) to frontend fields (camelCase)
      if (data) {
        console.log('ProfileScreen onRefresh: Raw data:', {
          hasAddress: !!data.address,
          addressType: typeof data.address,
          addressValue: data.address ? JSON.stringify(data.address) : 'null',
          addressKeys: data.address && typeof data.address === 'object' ? Object.keys(data.address) : [],
          hasProfileImage: !!data.profile_image,
          profileImageValue: data.profile_image || 'null',
          profileImageType: typeof data.profile_image,
          profileImageLength: data.profile_image?.length || 0
        });

        // Helper function to map address
        const mapAddress = (addr: any) => {
          if (!addr) return null;

          // If address is a string, try to parse it
          if (typeof addr === 'string') {
            try {
              addr = JSON.parse(addr);
            } catch (e) {
              console.warn('Failed to parse address string:', e);
              return null;
            }
          }

          // Map address object (handle both snake_case and camelCase)
          return {
            street: addr.street || addr.street_address || null,
            city: addr.city || null,
            state: addr.state || null,
            postalCode: addr.postal_code || addr.postalCode || addr.zip || null,
            country: addr.country || null,
          };
        };

        const mappedData = {
          ...data,
          // Map profile_image to profileImage - add cache-bust to force reload
          // This ensures images are always fresh, especially after uploads
          profileImage: data.profile_image && typeof data.profile_image === 'string'
            ? `${data.profile_image.trim()}?t=${Date.now()}`
            : (data.profile_image || null),
          phoneNumber: data.phone_number || null,
          // Map professional fields (snake_case to camelCase)
          taxiPermitNumber: data.taxi_permit_number || null,
          licenseType: data.license_type || null,
          skills: data.skills || null,
          experience: data.experience || null,
          // Map license and ID card images
          licenseFrontUrl: data.license_front_url || null,
          licenseBackUrl: data.license_back_url || null,
          idCardFrontUrl: data.idcard_front_url || null,
          idCardBackUrl: data.idcard_back_url || null,
          // Map bank_info (snake_case JSONB) to bankInfo (camelCase)
          bankInfo: data.bank_info ? {
            accountName: data.bank_info.account_name || null,
            accountNumber: data.bank_info.account_number || null,
            bankName: data.bank_info.bank_name || null,
            swiftCode: data.bank_info.swift_code || null,
          } : null,
          // Map company_info (snake_case JSONB) to companyInfo (camelCase)
          companyInfo: data.company_info ? {
            companyName: data.company_info.company_name || null,
            taxId: data.company_info.tax_id || null,
            carPlateNumber: data.company_info.car_plate_number || null,
          } : null,
          // Map address with better handling
          address: mapAddress(data.address),
        };

        console.log('ProfileScreen onRefresh: Mapped professional data:', {
          taxiPermitNumber: mappedData.taxiPermitNumber,
          licenseType: mappedData.licenseType,
          skills: mappedData.skills,
          experience: mappedData.experience ? mappedData.experience.substring(0, 50) + '...' : null
        });

        console.log('ProfileScreen onRefresh: Mapped address:', mappedData.address);
        updateUserData(mappedData);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refresh profile data',
        position: 'bottom',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        throw new Error('Failed to get push token');
      }

      // Update the user record with the new token
      const { error: updateError } = await supabase
        .from('users')
        .update({
          expo_push_token: token,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      // Force refresh the profile data
      await onRefresh();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Push notifications enabled successfully',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error enabling notifications:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to enable push notifications. Please check your device settings.',
        position: 'bottom',
      });
    }
  };

  const renderEditableField = (label: string, field: string, value: string) => {
    const handleChange = (text: string) => {
      // Handle nested fields like 'bankInfo.accountName'
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        setEditedData({
          ...editedData,
          [parent]: {
            ...editedData[parent],
            [child]: text
          }
        });
      } else {
        setEditedData({ ...editedData, [field]: text });
      }
    };

    return (
      <TextInput
        label={label}
        value={value || ''}
        onChangeText={handleChange}
        mode="outlined"
        style={styles.input}
      />
    );
  };

  const renderInfoSection = (title: string, section: EditableSection, content: React.ReactNode) => (
    <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>{title}</Text>
        {editingSection === section ? (
          <View style={styles.editActions}>
            <Button
              mode="text"
              onPress={() => {
                setEditingSection(null);
                // Reset document images if canceling documents section
                if (section === 'documents') {
                  setDocumentImages({
                    licenseFront: null,
                    licenseBack: null,
                    idCardFront: null,
                    idCardBack: null,
                  });
                }
              }}
              labelStyle={styles.buttonTextLabel}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => handleSave(section)}
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
              loading={section === 'documents' ? uploadingDocuments : false}
              disabled={section === 'documents' ? uploadingDocuments : false}
            >
              Save
            </Button>
          </View>
        ) : (
          <Button
            mode="text"
            onPress={() => startEditing(section)}
            labelStyle={styles.buttonTextLabel}
          >
            Edit
          </Button>
        )}
      </View>
      <View style={styles.sectionContent}>
        {content}
      </View>
    </Surface>
  );

  const startEditing = (section: EditableSection) => {
    setEditingSection(section);
    if (section === 'account') {
      // Reset account data when starting to edit
      setAccountData({
        newEmail: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswords({ current: false, new: false, confirm: false });
    } else {
      setEditedData(userData);
    }
  };

  const handleChangeEmail = async () => {
    try {
      if (!accountData.newEmail.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Email Required',
          text2: 'Please enter a new email address',
          position: 'bottom',
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(accountData.newEmail.trim())) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Email',
          text2: 'Please enter a valid email address',
          position: 'bottom',
        });
        return;
      }

      if (accountData.newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
        Toast.show({
          type: 'error',
          text1: 'Same Email',
          text2: 'The new email must be different from your current email',
          position: 'bottom',
        });
        return;
      }

      setChangingEmail(true);

      // Update email in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        email: accountData.newEmail.trim().toLowerCase(),
      });

      if (updateError) {
        throw updateError;
      }

      Toast.show({
        type: 'success',
        text1: 'Email Update Initiated',
        text2: 'Please check your new email for a confirmation link. Your email will be updated after confirmation.',
        position: 'bottom',
      });

      // Reset form
      setAccountData(prev => ({ ...prev, newEmail: '' }));
      setEditingSection(null);
    } catch (error: any) {
      console.error('Error changing email:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update email. Please try again.',
        position: 'bottom',
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!accountData.currentPassword) {
        Toast.show({
          type: 'error',
          text1: 'Current Password Required',
          text2: 'Please enter your current password',
          position: 'bottom',
        });
        return;
      }

      if (!accountData.newPassword) {
        Toast.show({
          type: 'error',
          text1: 'New Password Required',
          text2: 'Please enter a new password',
          position: 'bottom',
        });
        return;
      }

      if (accountData.newPassword.length < 6) {
        Toast.show({
          type: 'error',
          text1: 'Password Too Short',
          text2: 'Password must be at least 6 characters long',
          position: 'bottom',
        });
        return;
      }

      if (accountData.newPassword !== accountData.confirmPassword) {
        Toast.show({
          type: 'error',
          text1: 'Passwords Do Not Match',
          text2: 'Please make sure both password fields match',
          position: 'bottom',
        });
        return;
      }

      if (accountData.currentPassword === accountData.newPassword) {
        Toast.show({
          type: 'error',
          text1: 'Same Password',
          text2: 'New password must be different from your current password',
          position: 'bottom',
        });
        return;
      }

      setChangingPassword(true);

      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: accountData.currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: accountData.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      Toast.show({
        type: 'success',
        text1: 'Password Updated',
        text2: 'Your password has been changed successfully',
        position: 'bottom',
      });

      // Reset form
      setAccountData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setShowPasswords({ current: false, new: false, confirm: false });
      setEditingSection(null);
    } catch (error: any) {
      console.error('Error changing password:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update password. Please try again.',
        position: 'bottom',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async (section: EditableSection) => {
    try {
      if (!user?.id) return;

      // Build updates object with proper structure for database
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Map section-specific fields to database format
      if (section === 'bank') {
        // Structure bank_info as JSONB object with snake_case keys
        updates.bank_info = {
          account_name: editedData.bankInfo?.accountName || null,
          account_number: editedData.bankInfo?.accountNumber || null,
          bank_name: editedData.bankInfo?.bankName || null,
          swift_code: editedData.bankInfo?.swiftCode || null,
        };
      } else if (section === 'company') {
        // Structure company_info as JSONB object with snake_case keys
        updates.company_info = {
          company_name: editedData.companyInfo?.companyName || null,
          tax_id: editedData.companyInfo?.taxId || null,
          car_plate_number: editedData.companyInfo?.carPlateNumber || null,
        };
      } else if (section === 'contact') {
        // Handle contact fields (phone_number and address)
        if (editedData.phoneNumber !== undefined) {
          updates.phone_number = editedData.phoneNumber;
        }
        if (editedData.address) {
          // Structure address as JSONB object with snake_case keys
          updates.address = {
            street: editedData.address.street || null,
            city: editedData.address.city || null,
            state: editedData.address.state || null,
            postal_code: editedData.address.postalCode || null,
            country: editedData.address.country || null,
          };
        }
      } else if (section === 'professional') {
        // Handle professional fields
        if (editedData.skills !== undefined) {
          updates.skills = editedData.skills;
        }
        if (editedData.experience !== undefined) {
          updates.experience = editedData.experience;
        }
        if (editedData.taxiPermitNumber !== undefined) {
          updates.taxi_permit_number = editedData.taxiPermitNumber;
        }
        if (editedData.licenseType !== undefined) {
          updates.license_type = editedData.licenseType;
        }
      } else if (section === 'documents') {
        // Handle document image uploads
        setUploadingDocuments(true);
        
        // Helper function to upload document image
        const uploadDocumentImage = async (
          imageData: { base64: string; uri: string } | null,
          bucket: string,
          fileName: string
        ): Promise<string | null> => {
          if (!imageData) return null;
          
          try {
            // On Android, use FormData with URI (more reliable)
            if (Platform.OS === 'android') {
              console.log('Uploading via FormData (Android):', { fileName, bucket });
              
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              if (sessionError || !session?.access_token) {
                throw new Error('Not authenticated');
              }
              
              const formData = new FormData();
              formData.append('file', {
                uri: imageData.uri,
                name: fileName,
                type: 'image/jpeg',
              } as any);
              
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
              const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;
              const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'x-upsert': 'true',
                },
                body: formData,
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
              }
              
              const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);
              return publicUrl;
            } else {
              // On iOS, use ArrayBuffer from base64
              console.log('Uploading via ArrayBuffer (iOS):', { fileName, bucket });
              const decodedImage = decode(imageData.base64);
              
              const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, decodedImage, {
                  contentType: 'image/jpeg',
                  upsert: true,
                });
              
              if (uploadError) {
                throw uploadError;
              }
              
              const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);
              return publicUrl;
            }
          } catch (err: any) {
            console.error(`Failed to upload ${fileName}:`, err);
            throw err;
          }
        };
        
        try {
          // Upload license images
          if (documentImages.licenseFront) {
            const fileName = `${user.id}-license-front.jpg`;
            const publicUrl = await uploadDocumentImage(documentImages.licenseFront, 'licence', fileName);
            if (publicUrl) {
              updates.license_front_url = publicUrl;
              console.log('License front uploaded successfully:', publicUrl);
            }
          }
          
          if (documentImages.licenseBack) {
            const fileName = `${user.id}-license-back.jpg`;
            const publicUrl = await uploadDocumentImage(documentImages.licenseBack, 'licence', fileName);
            if (publicUrl) {
              updates.license_back_url = publicUrl;
              console.log('License back uploaded successfully:', publicUrl);
            }
          }
          
          // Upload ID card images
          if (documentImages.idCardFront) {
            const fileName = `${user.id}-idcard-front.jpg`;
            const publicUrl = await uploadDocumentImage(documentImages.idCardFront, 'Idcards', fileName);
            if (publicUrl) {
              updates.idcard_front_url = publicUrl;
              console.log('ID card front uploaded successfully:', publicUrl);
            }
          }
          
          if (documentImages.idCardBack) {
            const fileName = `${user.id}-idcard-back.jpg`;
            const publicUrl = await uploadDocumentImage(documentImages.idCardBack, 'Idcards', fileName);
            if (publicUrl) {
              updates.idcard_back_url = publicUrl;
              console.log('ID card back uploaded successfully:', publicUrl);
            }
          }
        } catch (uploadError: any) {
          console.error('Error uploading documents:', uploadError);
          const errorMessage = uploadError?.message || 'Network request failed';
          Toast.show({
            type: 'error',
            text1: 'Upload Error',
            text2: errorMessage.includes('Network') 
              ? 'Network error. Please check your connection and try again.'
              : 'Some images may not have uploaded. Please try again.',
            position: 'bottom',
          });
        } finally {
          setUploadingDocuments(false);
        }
      }

      // Only update if there are actual changes
      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);

        if (error) throw error;

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Profile updated successfully',
          position: 'bottom',
        });

        setEditingSection(null);
        onRefresh();
      } else {
        setEditingSection(null);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to save changes',
        position: 'bottom',
      });
    }
  };

  const renderNotificationStatus = () => {
    if (userData?.role !== 'admin') return null;

    return (
      <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>Notification Settings</Text>
        </View>
        <View style={styles.sectionContent}>
          {userData?.expo_push_token ? (
            <View>
              <Text variant="bodyLarge" style={[styles.successText, { color: surfaceColors.text }]}>✓ Push notifications are enabled</Text>
              <Text variant="bodyMedium" style={[styles.infoText, { color: surfaceColors.textSecondary }]}>You will receive notifications when drivers accept or complete jobs.</Text>
              <Text variant="bodySmall" style={[styles.tokenText, { color: surfaceColors.textSecondary }]}>Token: {userData.expo_push_token}</Text>
            </View>
          ) : (
            <View>
              <Text variant="bodyLarge" style={[styles.warningText, { color: surfaceColors.text }]}>⚠️ Push notifications are not enabled</Text>
              <Text variant="bodyMedium" style={[styles.infoText, { color: surfaceColors.textSecondary }]}>Enable notifications to receive updates when drivers accept or complete jobs.</Text>
              <Button
                mode="contained"
                onPress={handleEnableNotifications}
                style={styles.enableButton}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
              >
                Enable Notifications
              </Button>
            </View>
          )}
        </View>
      </Surface>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={gradientColors}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={{ color: surfaceColors.text }}>Loading profile...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradientColors as readonly [string, string]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Surface style={[styles.header, { backgroundColor: surfaceColors.surface }]} elevation={2}>
            <View style={styles.profileHeader}>
              {(() => {
                const imageUrl = userData?.profileImage || userData?.profile_image;
                const isValidUrl = imageUrl &&
                  typeof imageUrl === 'string' &&
                  imageUrl.trim() !== '' &&
                  (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));

                // Use the image URL as-is (Supabase public URLs should work without cache-busting)
                // If image doesn't load, it might be a permissions or file existence issue
                const fullImageUrl = isValidUrl ? imageUrl.trim() : null;

                console.log('ProfileScreen: Rendering avatar:', {
                  hasProfileImage: !!userData?.profileImage,
                  hasProfile_image: !!userData?.profile_image,
                  originalImageUrl: imageUrl || 'null',
                  imageUrlWithCacheBust: fullImageUrl || 'null',
                  isValidUrl,
                  imageUrlLength: imageUrl?.length || 0
                });

                // If image failed to load or URL is invalid, show default
                const shouldShowDefault = !isValidUrl || !fullImageUrl || imageError;

                // Show selected image if available (while uploading)
                const displayImage = selectedImage
                  ? `data:image/jpeg;base64,${selectedImage}`
                  : (shouldShowDefault ? null : fullImageUrl);

                // Use the image URL directly (cache-busting is handled in uploadImage)
                // If profileImage has a cache-bust parameter, use it; otherwise use the base URL
                const imageUri = displayImage
                  ? (selectedImage ? displayImage : fullImageUrl)
                  : null;

                const avatarContent = (
                  <View style={{ position: 'relative' }}>
                    {selectedImage ? (
                      // Show selected image while uploading
                      <Avatar.Image
                        size={100}
                        source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
                        onError={(error) => {
                          console.warn('Selected image failed to display:', error);
                          setSelectedImage(null);
                        }}
                      />
                    ) : shouldShowDefault || imageError ? (
                      // Show default avatar if image error or invalid URL
                      <Avatar.Image
                        size={100}
                        source={require('../assets/default-avatar.png')}
                      />
                    ) : (
                      // Try to show profile image with fallback
                      <AvatarWithFallback
                        size={100}
                        imageUrl={fullImageUrl}
                        fallbackLabel={userData?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                      />
                    )}
                    {uploadingImage && (
                      <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 50,
                      }}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#4083FF',
                      borderRadius: 15,
                      width: 30,
                      height: 30,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#fff',
                    }}>
                      <Text variant="bodySmall" style={{ color: '#fff', fontSize: 18 }}>📷</Text>
                    </View>
                  </View>
                );

                return (
                  <TouchableOpacity
                    onPress={pickImage}
                    disabled={uploadingImage}
                    activeOpacity={0.7}
                  >
                    {avatarContent}
                  </TouchableOpacity>
                );
              })()}
              <View style={styles.headerInfo}>
                <Text variant="headlineSmall" style={[styles.name, { color: surfaceColors.text }]}>{userData?.name}</Text>
                <Text variant="bodyLarge" style={[styles.email, { color: surfaceColors.textSecondary }]}>{userData?.email}</Text>
                <Chip icon={userData?.driverType === 'company' ? 'domain' : 'account'}>
                  {userData?.driverType === 'company' ? 'Company Driver' : 'Individual Driver'}
                </Chip>
              </View>
            </View>
          </Surface>

          {renderNotificationStatus()}

          {userData?.driverType === 'company' ? (
            renderInfoSection('Company Information', 'company',
              editingSection === 'company' ? (
                <View>
                  {renderEditableField('Company Name', 'companyInfo.companyName', userData.companyInfo?.companyName)}
                  {renderEditableField('Tax ID', 'companyInfo.taxId', userData.companyInfo?.taxId)}
                  {renderEditableField('Car Plate', 'companyInfo.carPlateNumber', userData.companyInfo?.carPlateNumber)}
                </View>
              ) : (
                <View>
                  <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>Company: {userData.companyInfo?.companyName}</Text>
                  <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Tax ID: {userData.companyInfo?.taxId}</Text>
                  <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Car Plate: {userData.companyInfo?.carPlateNumber}</Text>
                </View>
              )
            )
          ) : (
            renderInfoSection('Professional Information', 'professional',
              editingSection === 'professional' ? (
                <View>
                  {renderEditableField('Taxi Permit', 'taxiPermitNumber', userData.taxiPermitNumber)}
                  {renderEditableField('Skills', 'skills', userData.skills)}
                  {renderEditableField('Experience', 'experience', userData.experience)}
                </View>
              ) : (
                <View>
                  <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>Taxi Permit: {userData.taxiPermitNumber}</Text>
                  <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Skills: {userData.skills}</Text>
                  <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Experience: {userData.experience}</Text>
                </View>
              )
            )
          )}

          {renderInfoSection('Contact Information', 'contact',
            editingSection === 'contact' ? (
              <View>
                {renderEditableField('Phone Number', 'phoneNumber', userData.phoneNumber)}
                {renderEditableField('Street', 'address.street', userData.address?.street)}
                {renderEditableField('City', 'address.city', userData.address?.city)}
                {renderEditableField('State', 'address.state', userData.address?.state)}
                {renderEditableField('Postal Code', 'address.postalCode', userData.address?.postalCode)}
                {renderEditableField('Country', 'address.country', userData.address?.country)}
              </View>
            ) : (
              <View>
                <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>Phone: {userData.phoneNumber || 'Not provided'}</Text>
                {userData.address?.street || userData.address?.city ? (
                  <>
                    <Text variant="bodyMedium" style={{ marginTop: 8, color: surfaceColors.textSecondary }}>Address:</Text>
                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                      {userData.address?.street}, {userData.address?.city}
                      {userData.address?.state ? `, ${userData.address.state}` : ''}
                      {userData.address?.postalCode ? ` ${userData.address.postalCode}` : ''}
                      {userData.address?.country ? `, ${userData.address.country}` : ''}
                    </Text>
                  </>
                ) : (
                  <Text variant="bodyMedium" style={{ marginTop: 8, color: surfaceColors.textSecondary }}>No address provided</Text>
                )}
              </View>
            )
          )}

          {renderInfoSection('Bank Information', 'bank',
            editingSection === 'bank' ? (
              <View>
                {renderEditableField('Account Name', 'bankInfo.accountName', userData.bankInfo?.accountName)}
                {renderEditableField('Bank Name', 'bankInfo.bankName', userData.bankInfo?.bankName)}
                {renderEditableField('Account Number', 'bankInfo.accountNumber', userData.bankInfo?.accountNumber)}
                {renderEditableField('SWIFT Code', 'bankInfo.swiftCode', userData.bankInfo?.swiftCode)}
              </View>
            ) : (
              <View>
                <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>Account Name: {userData.bankInfo?.accountName}</Text>
                <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Bank: {userData.bankInfo?.bankName}</Text>
                <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>Account: ••••{userData.bankInfo?.accountNumber?.slice(-4)}</Text>
                <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>SWIFT: {userData.bankInfo?.swiftCode}</Text>
              </View>
            )
          )}

          {/* Documents Section - License and ID Cards */}
          {(userData?.role === 'driver' || userData?.driverType) && (
            renderInfoSection('Documents', 'documents',
              editingSection === 'documents' ? (
                <View>
                  <Text variant="titleSmall" style={{ color: surfaceColors.text, marginBottom: 12, fontWeight: '600' }}>
                    Driver's License
                  </Text>
                  <View style={styles.documentRow}>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Front
                      </Text>
                      {(documentImages.licenseFront ? (
                        <Image
                          source={{ uri: documentImages.licenseFront.uri }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : userData.licenseFrontUrl ? (
                        <Image
                          source={{ uri: userData.licenseFrontUrl }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      ))}
                      <Button
                        mode="outlined"
                        onPress={() => pickDocumentImage('licenseFront')}
                        style={{ marginTop: 8 }}
                        compact
                      >
                        {documentImages.licenseFront || userData.licenseFrontUrl ? 'Change' : 'Upload'}
                      </Button>
                    </View>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Back
                      </Text>
                      {(documentImages.licenseBack ? (
                        <Image
                          source={{ uri: documentImages.licenseBack.uri }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : userData.licenseBackUrl ? (
                        <Image
                          source={{ uri: userData.licenseBackUrl }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      ))}
                      <Button
                        mode="outlined"
                        onPress={() => pickDocumentImage('licenseBack')}
                        style={{ marginTop: 8 }}
                        compact
                      >
                        {documentImages.licenseBack || userData.licenseBackUrl ? 'Change' : 'Upload'}
                      </Button>
                    </View>
                  </View>

                  <Text variant="titleSmall" style={{ color: surfaceColors.text, marginTop: 16, marginBottom: 12, fontWeight: '600' }}>
                    ID Card
                  </Text>
                  <View style={styles.documentRow}>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Front
                      </Text>
                      {(documentImages.idCardFront ? (
                        <Image
                          source={{ uri: documentImages.idCardFront.uri }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : userData.idCardFrontUrl ? (
                        <Image
                          source={{ uri: userData.idCardFrontUrl }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      ))}
                      <Button
                        mode="outlined"
                        onPress={() => pickDocumentImage('idCardFront')}
                        style={{ marginTop: 8 }}
                        compact
                      >
                        {documentImages.idCardFront || userData.idCardFrontUrl ? 'Change' : 'Upload'}
                      </Button>
                    </View>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Back
                      </Text>
                      {(documentImages.idCardBack ? (
                        <Image
                          source={{ uri: documentImages.idCardBack.uri }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : userData.idCardBackUrl ? (
                        <Image
                          source={{ uri: userData.idCardBackUrl }}
                          style={styles.documentImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      ))}
                      <Button
                        mode="outlined"
                        onPress={() => pickDocumentImage('idCardBack')}
                        style={{ marginTop: 8 }}
                        compact
                      >
                        {documentImages.idCardBack || userData.idCardBackUrl ? 'Change' : 'Upload'}
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <View>
                  <Text variant="titleSmall" style={{ color: surfaceColors.text, marginBottom: 12, fontWeight: '600' }}>
                    Driver's License
                  </Text>
                  <View style={styles.documentRow}>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Front
                      </Text>
                      {userData.licenseFrontUrl ? (
                        <TouchableOpacity
                          onPress={() => {
                            console.log('View license front:', userData.licenseFrontUrl);
                          }}
                        >
                          <Image
                            source={{ uri: userData.licenseFrontUrl }}
                            style={styles.documentImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Back
                      </Text>
                      {userData.licenseBackUrl ? (
                        <TouchableOpacity
                          onPress={() => {
                            console.log('View license back:', userData.licenseBackUrl);
                          }}
                        >
                          <Image
                            source={{ uri: userData.licenseBackUrl }}
                            style={styles.documentImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text variant="titleSmall" style={{ color: surfaceColors.text, marginTop: 16, marginBottom: 12, fontWeight: '600' }}>
                    ID Card
                  </Text>
                  <View style={styles.documentRow}>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Front
                      </Text>
                      {userData.idCardFrontUrl ? (
                        <TouchableOpacity
                          onPress={() => {
                            console.log('View ID card front:', userData.idCardFrontUrl);
                          }}
                        >
                          <Image
                            source={{ uri: userData.idCardFrontUrl }}
                            style={styles.documentImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.documentItem}>
                      <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, marginBottom: 8 }}>
                        Back
                      </Text>
                      {userData.idCardBackUrl ? (
                        <TouchableOpacity
                          onPress={() => {
                            console.log('View ID card back:', userData.idCardBackUrl);
                          }}
                        >
                          <Image
                            source={{ uri: userData.idCardBackUrl }}
                            style={styles.documentImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.documentPlaceholder, { backgroundColor: surfaceColors.border }]}>
                          <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary }}>
                            Not uploaded
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )
            )
          )}

          {renderInfoSection('Account Settings', 'account',
            editingSection === 'account' ? (
              <View>
                <Text variant="titleSmall" style={[styles.subsectionTitle, { color: surfaceColors.text, marginBottom: 8 }]}>
                  Change Email Address
                </Text>
                <TextInput
                  label="New Email Address"
                  value={accountData.newEmail}
                  onChangeText={(text) => setAccountData(prev => ({ ...prev, newEmail: text }))}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  disabled={changingEmail}
                />
                <Button
                  mode="contained"
                  onPress={handleChangeEmail}
                  style={[styles.actionButton, { marginTop: 8 }]}
                  labelStyle={styles.buttonLabel}
                  contentStyle={styles.buttonContent}
                  loading={changingEmail}
                  disabled={changingEmail || !accountData.newEmail.trim()}
                >
                  Update Email
                </Button>

                <View style={[styles.divider, { backgroundColor: surfaceColors.border, marginVertical: 24 }]} />

                <Text variant="titleSmall" style={[styles.subsectionTitle, { color: surfaceColors.text, marginBottom: 8 }]}>
                  Change Password
                </Text>
                <TextInput
                  label="Current Password"
                  value={accountData.currentPassword}
                  onChangeText={(text) => setAccountData(prev => ({ ...prev, currentPassword: text }))}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry={!showPasswords.current}
                  autoCapitalize="none"
                  autoComplete="password"
                  disabled={changingPassword}
                  right={
                    <TextInput.Icon
                      icon={showPasswords.current ? 'eye-off' : 'eye'}
                      onPress={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    />
                  }
                />
                <TextInput
                  label="New Password"
                  value={accountData.newPassword}
                  onChangeText={(text) => setAccountData(prev => ({ ...prev, newPassword: text }))}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry={!showPasswords.new}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  disabled={changingPassword}
                  right={
                    <TextInput.Icon
                      icon={showPasswords.new ? 'eye-off' : 'eye'}
                      onPress={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    />
                  }
                />
                <TextInput
                  label="Confirm New Password"
                  value={accountData.confirmPassword}
                  onChangeText={(text) => setAccountData(prev => ({ ...prev, confirmPassword: text }))}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry={!showPasswords.confirm}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  disabled={changingPassword}
                  right={
                    <TextInput.Icon
                      icon={showPasswords.confirm ? 'eye-off' : 'eye'}
                      onPress={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    />
                  }
                />
                <Button
                  mode="contained"
                  onPress={handleChangePassword}
                  style={[styles.actionButton, { marginTop: 8 }]}
                  labelStyle={styles.buttonLabel}
                  contentStyle={styles.buttonContent}
                  loading={changingPassword}
                  disabled={changingPassword || !accountData.currentPassword || !accountData.newPassword || !accountData.confirmPassword}
                >
                  Update Password
                </Button>
              </View>
            ) : (
              <View>
                <View style={styles.accountInfoRow}>
                  <View style={styles.accountInfoItem}>
                    <Text variant="bodyLarge" style={{ color: surfaceColors.text, fontWeight: '600' }}>Email</Text>
                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary, marginTop: 4 }}>
                      {userData?.email || user?.email || 'Not available'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: surfaceColors.border, marginVertical: 12 }]} />
                <Text variant="bodySmall" style={{ color: surfaceColors.textSecondary, fontStyle: 'italic' }}>
                  Use the Edit button to change your email address or password
                </Text>
              </View>
            )
          )}

          <Button
            mode="contained"
            onPress={() => navigation.navigate('CompleteProfile')}
            style={styles.editButton}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            icon="pencil"
          >
            Edit Full Profile
          </Button>

          <Copyright />
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    color: '#666',
    marginBottom: 8,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontWeight: '500',
    marginBottom: 12,
    color: '#333',
  },
  sectionContent: {
    gap: 8,
  },
  editButton: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#6949FF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  successText: {
    color: '#4CAF50',
    marginBottom: 8,
  },
  warningText: {
    color: '#FF9800',
    marginBottom: 8,
  },
  infoText: {
    color: '#666',
    marginBottom: 16,
  },
  enableButton: {
    backgroundColor: '#6949FF',
  },
  tokenText: {
    color: '#666',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 8,
  },
  subsectionTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: '#6949FF',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  accountInfoRow: {
    marginBottom: 8,
  },
  accountInfoItem: {
    marginBottom: 12,
  },
  documentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  documentItem: {
    flex: 1,
  },
  documentImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  documentPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  buttonTextLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  buttonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
}); 