import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, TextInput, Avatar, Surface, SegmentedButtons, Chip, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Copyright from '../components/Copyright';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

type LicenseType = 'B' | 'B/96' | 'BE' | 'C' | 'C1' | 'C1E' | 'D' | 'D1' | 'D1E' | 'DE';

type NestedKeys<T> = {
  [K in keyof T]: T[K] extends object
  ? keyof T[K]
  : never;
}[keyof T];

interface FormData {
  phoneNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  companyInfo: {
    companyName: string;
    taxId: string;
    carPlateNumber: string;
  };
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  };
}

const AVAILABLE_SKILLS = [
  'City Driving',
  'Highway Driving',
  'Night Driving',
  'Heavy Traffic',
  'GPS Navigation',
  'Customer Service',
  'Vehicle Maintenance',
  'Emergency Response',
  'Defensive Driving',
  'First Aid'
];

export default function CompleteProfileScreen() {
  const { user, userData, signOut, updateUserData } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [driverType, setDriverType] = useState<'individual' | 'company'>(userData?.driverType || 'individual');
  const [licenseType, setLicenseType] = useState<LicenseType>('B');
  const [licenseFront, setLicenseFront] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<string | null>(null);
  const [idCardFront, setIdCardFront] = useState<string | null>(null);
  const [idCardBack, setIdCardBack] = useState<string | null>(null);
  const [fullName, setFullName] = useState(userData?.name || '');
  const [email] = useState(userData?.email || '');
  const [taxiPermitNumber, setTaxiPermitNumber] = useState(userData?.taxiPermitNumber || '');
  const [skills, setSkills] = useState(userData?.skills || '');
  const [experience, setExperience] = useState(userData?.experience || '');
  const [companyName, setCompanyName] = useState(userData?.companyInfo?.companyName || '');
  const [taxId, setTaxId] = useState(userData?.companyInfo?.taxId || '');
  const [street, setStreet] = useState(userData?.address?.street || '');
  const [city, setCity] = useState(userData?.address?.city || '');
  const [state, setState] = useState(userData?.address?.state || '');
  const [postalCode, setPostalCode] = useState(userData?.address?.postalCode || '');
  const [country, setCountry] = useState(userData?.address?.country || '');
  const [accountName, setAccountName] = useState(userData?.bankInfo?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(userData?.bankInfo?.accountNumber || '');
  const [bankName, setBankName] = useState(userData?.bankInfo?.bankName || '');
  const [swiftCode, setSwiftCode] = useState(userData?.bankInfo?.swiftCode || '');

  const [formData, setFormData] = useState<FormData>({
    phoneNumber: userData?.phoneNumber || '',
    address: {
      street: userData?.address?.street || '',
      city: userData?.address?.city || '',
      state: userData?.address?.state || '',
      postalCode: userData?.address?.postalCode || '',
      country: userData?.address?.country || '',
    },
    companyInfo: {
      companyName: userData?.companyInfo?.companyName || '',
      taxId: userData?.companyInfo?.taxId || '',
      carPlateNumber: userData?.companyInfo?.carPlateNumber || '',
    },
    bankInfo: {
      accountName: userData?.bankInfo?.accountName || '',
      accountNumber: userData?.bankInfo?.accountNumber || '',
      bankName: userData?.bankInfo?.bankName || '',
      swiftCode: userData?.bankInfo?.swiftCode || '',
    },
  });

  const updateFormField = (
    section: keyof Omit<FormData, 'phoneNumber'>,
    field: NestedKeys<FormData>,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setProfileImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const pickDocument = async (
    setDocument: (value: string | null) => void,
    documentType: string
  ) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setDocument(result.assets[0].base64);
      }
    } catch (error) {
      console.error(`Error picking ${documentType}:`, error);
    }
  };

  const renderSection = (title: string, content: React.ReactNode) => (
    <Surface style={[styles.sectionSurface, isEditMode && styles.sectionEditing]} elevation={1}>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionInner}>
        <View style={styles.sectionContentWrapper}>
          {content}
        </View>
      </View>
    </Surface>
  );

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      let profileImageUrl = null;
      if (profileImage) {
        try {
          // Use fixed filename to replace existing image instead of creating new one
          const fileName = `${user.id}-profile.jpg`;
          const decodedImage = decode(profileImage);

          console.log('Uploading profile image:', {
            fileName,
            size: decodedImage.byteLength,
            sizeKB: Math.round(decodedImage.byteLength / 1024)
          });

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, decodedImage, {
              contentType: 'image/jpeg',
              upsert: true, // This will replace existing file with same name
            });

          if (uploadError) {
            console.error('Profile image upload error:', uploadError);
            throw new Error(`Failed to upload profile image: ${uploadError.message}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName);

          profileImageUrl = publicUrl;
          console.log('Profile image uploaded successfully:', publicUrl);
        } catch (uploadErr: any) {
          console.error('Error uploading profile image:', uploadErr);
          // Don't throw - allow profile to save without image if upload fails
          // User can retry later
          Toast.show({
            type: 'warning',
            text1: 'Image Upload Failed',
            text2: 'Profile will be saved without the new image. You can update it later.',
            position: 'bottom',
          });
        }
      }

      // Upload license images to licence bucket
      // Use fixed filenames to replace existing images instead of creating new ones
      let licenseFrontUrl = null;
      let licenseBackUrl = null;
      if (licenseFront) {
        const fileName = `${user.id}-license-front.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('licence')
          .upload(fileName, decode(licenseFront), {
            contentType: 'image/jpeg',
            upsert: true, // This will replace existing file with same name
          });
        if (uploadError) {
          console.error('Error uploading license front:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('licence')
            .getPublicUrl(fileName);
          licenseFrontUrl = publicUrl;
        }
      }
      if (licenseBack) {
        const fileName = `${user.id}-license-back.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('licence')
          .upload(fileName, decode(licenseBack), {
            contentType: 'image/jpeg',
            upsert: true, // This will replace existing file with same name
          });
        if (uploadError) {
          console.error('Error uploading license back:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('licence')
            .getPublicUrl(fileName);
          licenseBackUrl = publicUrl;
        }
      }

      // Upload ID card images to Idcards bucket
      // Use fixed filenames to replace existing images instead of creating new ones
      let idCardFrontUrl = null;
      let idCardBackUrl = null;
      if (idCardFront) {
        const fileName = `${user.id}-idcard-front.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('Idcards')
          .upload(fileName, decode(idCardFront), {
            contentType: 'image/jpeg',
            upsert: true, // This will replace existing file with same name
          });
        if (uploadError) {
          console.error('Error uploading ID card front:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('Idcards')
            .getPublicUrl(fileName);
          idCardFrontUrl = publicUrl;
        }
      }
      if (idCardBack) {
        const fileName = `${user.id}-idcard-back.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('Idcards')
          .upload(fileName, decode(idCardBack), {
            contentType: 'image/jpeg',
            upsert: true, // This will replace existing file with same name
          });
        if (uploadError) {
          console.error('Error uploading ID card back:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('Idcards')
            .getPublicUrl(fileName);
          idCardBackUrl = publicUrl;
        }
      }

      const updates = {
        name: fullName,
        driver_type: driverType,
        license_type: licenseType,
        taxi_permit_number: taxiPermitNumber,
        skills,
        experience,
        phone_number: formData.phoneNumber,
        address: {
          street: formData.address.street,
          city: formData.address.city,
          state: formData.address.state,
          postal_code: formData.address.postalCode,
          country: formData.address.country,
        },
        company_info: driverType === 'company' ? {
          company_name: companyName,
          tax_id: taxId,
          car_plate_number: formData.companyInfo.carPlateNumber,
        } : null,
        bank_info: {
          account_name: formData.bankInfo.accountName,
          account_number: formData.bankInfo.accountNumber,
          bank_name: formData.bankInfo.bankName,
          swift_code: formData.bankInfo.swiftCode,
        },
        profile_image: profileImageUrl || userData?.profileImage,
        license_front_url: licenseFrontUrl || userData?.licenseFrontUrl,
        license_back_url: licenseBackUrl || userData?.licenseBackUrl,
        idcard_front_url: idCardFrontUrl || userData?.idcardFrontUrl,
        idcard_back_url: idCardBackUrl || userData?.idcardBackUrl,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving profile with updates:', {
        profile_completed: updates.profile_completed,
        hasProfileCompleted: 'profile_completed' in updates,
        updatesKeys: Object.keys(updates)
      });

      const { error, data: updateResult } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select('id, profile_completed')
        .single();

      if (error) {
        console.error('Error updating users table:', error);
        throw error;
      }

      console.log('Profile update result from database:', {
        id: updateResult?.id,
        profile_completed: updateResult?.profile_completed,
        type: typeof updateResult?.profile_completed
      });

      // Insert or update profile in profiles table with ALL fields
      // This allows drivers to view, update, and delete all their profile data
      const profileData = {
        id: user.id,
        avatar_url: profileImageUrl || userData?.profileImage || null,
        phone_number: formData.phoneNumber,
        driver_type: driverType,
        license_type: licenseType,
        taxi_permit_number: taxiPermitNumber,
        skills: skills || null,
        experience: experience || null,
        address: {
          street: formData.address.street,
          city: formData.address.city,
          state: formData.address.state,
          postal_code: formData.address.postalCode,
          country: formData.address.country,
        },
        bank_info: {
          account_name: formData.bankInfo.accountName,
          account_number: formData.bankInfo.accountNumber,
          bank_name: formData.bankInfo.bankName,
          swift_code: formData.bankInfo.swiftCode,
        },
        company_info: driverType === 'company' ? {
          company_name: companyName,
          tax_id: taxId,
          car_plate_number: formData.companyInfo.carPlateNumber,
        } : null,
        license_front_url: licenseFrontUrl || null,
        license_back_url: licenseBackUrl || null,
        idcard_front_url: idCardFrontUrl || null,
        idcard_back_url: idCardBackUrl || null,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving profile data to profiles table:', {
        id: profileData.id,
        hasAvatar: !!profileData.avatar_url,
        hasLicenseFront: !!profileData.license_front_url,
        hasLicenseBack: !!profileData.license_back_url,
        hasIdCardFront: !!profileData.idcard_front_url,
        hasIdCardBack: !!profileData.idcard_back_url,
        driverType: profileData.driver_type,
        fieldsCount: Object.keys(profileData).length
      });

      const { error: profileError, data: profileResult } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select('id, avatar_url, driver_type, license_type, phone_number')
        .single();

      if (profileError) {
        console.error('❌ Error saving profile to profiles table:', profileError);
        // Don't throw - users table update succeeded, profile table is secondary
        // But log it so we can debug
        Toast.show({
          type: 'info',
          text1: 'Profile saved',
          text2: 'Main profile saved, but some details may need updating',
          position: 'bottom',
        });
      } else {
        console.log('✅ Profile saved to profiles table successfully:', {
          id: profileResult?.id,
          driverType: profileResult?.driver_type
        });
      }

      // Use the data returned from the update query which confirms what was saved
      // Map updates to ensure profile_image becomes profileImage
      const savedUserData = {
        ...userData,
        ...updates,
        profileImage: updates.profile_image || userData?.profileImage || null, // Map profile_image to profileImage
        profile_completed: updateResult?.profile_completed ?? true, // Use value from database
      };

      // Remove profile_image from savedUserData to avoid duplication (we use profileImage)
      delete (savedUserData as any).profile_image;

      console.log('Updating userData context with saved data:', {
        profile_completed: savedUserData.profile_completed,
        fromUpdateResult: updateResult?.profile_completed
      });

      // Update userData in context immediately with confirmed saved values
      updateUserData(savedUserData);

      // Double-check by fetching fresh data from database
      const { data: refreshedUserData, error: fetchError } = await supabase
        .from('users')
        .select('id, email, name, role, profile_completed, driver_type, phone_number, address, bank_info, company_info, profile_image')
        .eq('id', user.id)
        .single();

      if (!fetchError && refreshedUserData) {
        console.log('✅ Verified profile_completed in database:', {
          profile_completed: refreshedUserData.profile_completed,
          type: typeof refreshedUserData.profile_completed,
          isTrue: refreshedUserData.profile_completed === true
        });

        // Ensure profile_completed is definitely true if it was saved
        if (refreshedUserData.profile_completed === true) {
          // Map the refreshed data properly (snake_case to camelCase)
          const mappedRefreshedData = {
            ...refreshedUserData,
            profileImage: refreshedUserData.profile_image || savedUserData.profileImage || null,
            phoneNumber: refreshedUserData.phone_number || savedUserData.phoneNumber || null,
            bankInfo: refreshedUserData.bank_info ? {
              accountName: refreshedUserData.bank_info.account_name || null,
              accountNumber: refreshedUserData.bank_info.account_number || null,
              bankName: refreshedUserData.bank_info.bank_name || null,
              swiftCode: refreshedUserData.bank_info.swift_code || null,
            } : savedUserData.bankInfo || null,
            companyInfo: refreshedUserData.company_info ? {
              companyName: refreshedUserData.company_info.company_name || null,
              taxId: refreshedUserData.company_info.tax_id || null,
              carPlateNumber: refreshedUserData.company_info.car_plate_number || null,
            } : savedUserData.companyInfo || null,
            address: refreshedUserData.address ? {
              street: refreshedUserData.address.street || null,
              city: refreshedUserData.address.city || null,
              state: refreshedUserData.address.state || null,
              postalCode: refreshedUserData.address.postal_code || null,
              country: refreshedUserData.address.country || null,
            } : savedUserData.address || null,
          };

          // Update with fresh data from database to ensure consistency
          updateUserData({ ...savedUserData, ...mappedRefreshedData });
        } else {
          console.error('❌ ERROR: profile_completed is not true after save!', refreshedUserData);
        }
      } else if (fetchError) {
        console.error('Error verifying profile_completed:', fetchError);
      }

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile saved successfully',
        position: 'bottom',
      });

      // Reset navigation stack to DriverHome after successful save
      // This clears navigation history so user can't go back to the form
      setTimeout(() => {
        try {
          (navigation as any).reset({
            index: 0,
            routes: [{ name: 'DriverHome' }],
          });
        } catch (error) {
          console.log('Navigation error:', error);
          // Navigation component will handle routing automatically when it detects profile_completed=true
        }
      }, 500);

      // Handle document uploads here if needed

    } catch (error: any) {
      console.error('Error saving profile:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to save profile';

      if (error?.message) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (error.code === 'PGRST204') {
          errorMessage = 'Database schema error. Please contact support.';
        } else if (error.code === '23505') {
          errorMessage = 'Duplicate entry. This profile already exists.';
        } else {
          errorMessage = error.message;
        }
      } else if (error?.code) {
        errorMessage = `Error ${error.code}: ${error.message || 'Unknown error'}`;
      }

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom',
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Force exit to auth stack since Welcome isn't in the logged-in branch
    try {
      await signOut();
    } catch (e) {
      // As a fallback, stay on this screen
    }
  };

  const handleSkillToggle = (skill: string) => {
    const currentSkills: string[] = skills ? skills.split(',').map((s: string) => s.trim()) : [];
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter((s: string) => s !== skill)
      : [...currentSkills, skill];
    setSkills(newSkills.join(', '));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <LinearGradient
          colors={['#DAF2FB', '#4083FF']}
          style={styles.gradient}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>
                  Complete Profile
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                  Please fill in your profile details
                </Text>
              </View>

              <View style={styles.profileImageContainer}>
                <Avatar.Text
                  size={120}
                  label={fullName ? fullName[0].toUpperCase() : '?'}
                  style={{ backgroundColor: '#6949FF' }}
                />
                {profileImage && (
                  <Avatar.Image
                    size={120}
                    source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                    style={[styles.overlayAvatar, { backgroundColor: '#FFFFFF' }]}
                  />
                )}
                <Button
                  mode="outlined"
                  onPress={pickImage}
                  style={styles.uploadButton}
                  icon="camera"
                >
                  Upload Photo
                </Button>
              </View>

              {renderSection('Personal Information', (
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    mode="outlined"
                    style={styles.input}
                    disabled={!isEditMode}
                  />
                  <TextInput
                    label="Phone Number"
                    value={formData.phoneNumber}
                    onChangeText={(value) => setFormData(prev => ({ ...prev, phoneNumber: value }))}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                  <TextInput
                    label="Email"
                    value={email}
                    mode="outlined"
                    style={styles.input}
                    disabled
                  />

                  <Text style={styles.sectionSubtitle}>Driver Type *</Text>
                  <SegmentedButtons
                    value={driverType}
                    onValueChange={(value) => setDriverType(value as 'individual' | 'company')}
                    buttons={[
                      { value: 'individual', label: 'Individual Driver' },
                      { value: 'company', label: 'Company Driver' }
                    ]}
                    style={styles.driverTypeButtons}
                  />

                  <Text style={styles.sectionSubtitle}>Driver's License *</Text>
                  <View style={styles.licenseButtons}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <SegmentedButtons
                        value={licenseType}
                        onValueChange={(value) => setLicenseType(value as LicenseType)}
                        buttons={[
                          { value: 'B', label: 'B' },
                          { value: 'B/96', label: 'B/96' },
                          { value: 'BE', label: 'BE' },
                          { value: 'C', label: 'C' },
                          { value: 'C1', label: 'C1' },
                          { value: 'C1E', label: 'C1E' },
                          { value: 'D', label: 'D' },
                          { value: 'D1', label: 'D1' },
                          { value: 'D1E', label: 'D1E' },
                          { value: 'DE', label: 'DE' }
                        ]}
                        style={styles.segmentedButtons}
                      />
                    </ScrollView>
                  </View>

                  <View style={styles.documentSection}>
                    <Text style={styles.sectionSubtitle}>License Images *</Text>
                    <View style={styles.documentButtons}>
                      <Button
                        mode="outlined"
                        onPress={() => pickDocument(setLicenseFront, "License Front")}
                        style={[styles.documentButton, licenseFront ? styles.documentUploaded : null]}
                        icon={licenseFront ? "check" : "upload"}
                      >
                        Front Side
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => pickDocument(setLicenseBack, "License Back")}
                        style={[styles.documentButton, licenseBack ? styles.documentUploaded : null]}
                        icon={licenseBack ? "check" : "upload"}
                      >
                        Back Side
                      </Button>
                    </View>
                  </View>

                  <View style={styles.documentSection}>
                    <Text style={styles.sectionSubtitle}>ID Card Images *</Text>
                    <View style={styles.documentButtons}>
                      <Button
                        mode="outlined"
                        onPress={() => pickDocument(setIdCardFront, "ID Card Front")}
                        style={[styles.documentButton, idCardFront ? styles.documentUploaded : null]}
                        icon={idCardFront ? "check" : "upload"}
                      >
                        Front Side
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => pickDocument(setIdCardBack, "ID Card Back")}
                        style={[styles.documentButton, idCardBack ? styles.documentUploaded : null]}
                        icon={idCardBack ? "check" : "upload"}
                      >
                        Back Side
                      </Button>
                    </View>
                  </View>
                </View>
              ))}

              {driverType === 'individual' && renderSection('Professional Details', (
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Taxi Permit Card Number *"
                    value={taxiPermitNumber}
                    onChangeText={setTaxiPermitNumber}
                    mode="outlined"
                    style={styles.input}
                    placeholder="Enter your taxi permit number"
                    error={!taxiPermitNumber}
                  />
                  <Text style={styles.sectionSubtitle}>Skills * select at least one skill</Text>
                  <View style={styles.skillsContainer}>
                    {AVAILABLE_SKILLS.map((skill) => (
                      <Chip
                        key={skill}
                        selected={(skills || '').split(',').map((s: string) => s.trim()).includes(skill)}
                        onPress={() => handleSkillToggle(skill)}
                        style={styles.skillChip}
                        mode="outlined"
                      >
                        {skill}
                      </Chip>
                    ))}
                  </View>
                  <TextInput
                    label="Experience *"
                    value={experience}
                    onChangeText={(value) => setExperience(value)}
                    mode="outlined"
                    style={[styles.input, styles.experienceInput]}
                    multiline
                    numberOfLines={4}
                    maxLength={2000}
                    error={!experience}
                    placeholder="Describe your driving experience"
                  />
                  {!experience ? (
                    <HelperText type="error" visible={true}>Experience is required</HelperText>
                  ) : (
                    <HelperText type="info" visible={true}>
                      {experience.length}/2000 characters
                    </HelperText>
                  )}
                </View>
              ))}

              {driverType === 'company' && renderSection('Company Information', (
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Company Name"
                    value={companyName}
                    onChangeText={setCompanyName}
                    mode="outlined"
                    style={styles.input}
                  />
                  <TextInput
                    label="Tax ID"
                    value={taxId}
                    onChangeText={setTaxId}
                    mode="outlined"
                    style={styles.input}
                  />
                  <TextInput
                    label="Car Plate Number"
                    value={formData.companyInfo.carPlateNumber}
                    onChangeText={(value) => updateFormField('companyInfo', 'carPlateNumber', value)}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="characters"
                  />
                </View>
              ))}

              {renderSection('Address', (
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Street Address *"
                    value={formData.address.street}
                    onChangeText={(value) => updateFormField('address', 'street', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.address.street}
                  />
                  {!formData.address.street &&
                    <HelperText type="error">Street address is required</HelperText>
                  }

                  <TextInput
                    label="City *"
                    value={formData.address.city}
                    onChangeText={(value) => updateFormField('address', 'city', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.address.city}
                  />
                  {!formData.address.city &&
                    <HelperText type="error">City is required</HelperText>
                  }

                  <TextInput
                    label="Country *"
                    value={formData.address.country}
                    onChangeText={(value) => updateFormField('address', 'country', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.address.country}
                  />
                  {!formData.address.country &&
                    <HelperText type="error">Country is required</HelperText>
                  }

                  {formData.address.country === 'USA' && (
                    <TextInput
                      label="State *"
                      value={formData.address.state}
                      onChangeText={(value) => updateFormField('address', 'state', value)}
                      mode="outlined"
                      style={styles.input}
                      error={!formData.address.state}
                    />
                  )}
                  {formData.address.country === 'USA' && !formData.address.state &&
                    <HelperText type="error">State is required for USA addresses</HelperText>
                  }

                  <TextInput
                    label="Postal Code *"
                    value={formData.address.postalCode}
                    onChangeText={(value) => updateFormField('address', 'postalCode', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.address.postalCode}
                  />
                  {!formData.address.postalCode &&
                    <HelperText type="error">Postal code is required</HelperText>
                  }
                </View>
              ))}

              {renderSection('Bank Details', (
                <View style={styles.inputGroup}>
                  <TextInput
                    label="Account Name *"
                    value={formData.bankInfo.accountName}
                    onChangeText={(value) => updateFormField('bankInfo', 'accountName', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.bankInfo.accountName}
                  />
                  {!formData.bankInfo.accountName &&
                    <HelperText type="error">Account name is required</HelperText>
                  }

                  <TextInput
                    label="Account Number *"
                    value={formData.bankInfo.accountNumber}
                    onChangeText={(text) => {
                      let formatted = text.toUpperCase();

                      // Detect current country
                      const country = formData.address.country?.trim() || '';

                      if (country === 'Finland') {
                        // FI + 16 digits
                        if (!formatted.startsWith('FI')) {
                          formatted = 'FI' + formatted.replace(/[^0-9]/g, '');
                        } else {
                          const prefix = formatted.slice(0, 2);
                          const digits = formatted.slice(2).replace(/[^0-9]/g, '');
                          formatted = prefix + digits;
                        }
                        if (formatted.length > 18) formatted = formatted.slice(0, 18);
                      }
                      else if (['Germany', 'France', 'Spain', 'Italy', 'Netherlands'].includes(country)) {
                        // Generic IBAN countries — letters + digits, up to 22 chars
                        formatted = formatted.replace(/[^A-Z0-9]/g, '');
                        if (formatted.length > 22) formatted = formatted.slice(0, 22);
                      }
                      else {
                        // Default: local numeric account numbers only
                        formatted = formatted.replace(/[^0-9]/g, '');
                        if (formatted.length > 16) formatted = formatted.slice(0, 16);
                      }

                      updateFormField('bankInfo', 'accountNumber', formatted);
                    }}
                    keyboardType="default" // ✅ allows both digits + letters
                    autoCapitalize="characters"
                    mode="outlined"
                    style={styles.input}
                    placeholder={
                      formData.address.country === 'Finland'
                        ? 'FI + 16 digits'
                        : ['Germany', 'France', 'Spain', 'Italy', 'Netherlands'].includes(formData.address.country)
                          ? 'IBAN (letters + digits)'
                          : 'Account number (digits only)'
                    }
                    maxLength={
                      formData.address.country === 'Finland'
                        ? 18
                        : ['Germany', 'France', 'Spain', 'Italy', 'Netherlands'].includes(formData.address.country)
                          ? 22
                          : 16
                    }
                    error={
                      !formData.bankInfo.accountNumber ||
                      (formData.address.country === 'Finland' &&
                        !/^FI\d{16}$/.test(formData.bankInfo.accountNumber))
                    }
                  />

                  {/* Helper Text */}
                  {!formData.bankInfo.accountNumber ? (
                    <HelperText type="error">Account number is required</HelperText>
                  ) : formData.address.country === 'Finland' &&
                    !/^FI\d{16}$/.test(formData.bankInfo.accountNumber) ? (
                    <HelperText type="error">
                      Finnish account number must start with ‘FI’ followed by 16 digits
                    </HelperText>
                  ) : (
                    <HelperText type="info">
                      {formData.address.country === 'Finland'
                        ? 'Format: FI + 16 digits (e.g. FI12XXXXXXXXXXXXXX)'
                        : ['Germany', 'France', 'Spain', 'Italy', 'Netherlands'].includes(formData.address.country)
                          ? 'IBAN format: up to 22 alphanumeric characters'
                          : 'Digits only, up to 16 numbers'}
                    </HelperText>
                  )}



                  <TextInput
                    label="Bank Name *"
                    value={formData.bankInfo.bankName}
                    onChangeText={(value) => updateFormField('bankInfo', 'bankName', value)}
                    mode="outlined"
                    style={styles.input}
                    error={!formData.bankInfo.bankName}
                  />
                  {!formData.bankInfo.bankName &&
                    <HelperText type="error">Bank name is required</HelperText>
                  }

                  <TextInput
                    label="Swift Code (Optional)"
                    value={formData.bankInfo.swiftCode}
                    onChangeText={(value) => updateFormField('bankInfo', 'swiftCode', value)}
                    mode="outlined"
                    style={styles.input}
                  />
                </View>
              ))}

              <View style={styles.footer}>
                <View style={styles.actionButtonsContainer}>
                  <View style={styles.actionButtonsRow}>
                    <Button
                      mode="outlined"
                      onPress={handleCancel}
                      style={[styles.button, styles.cancelButton]}
                      icon="arrow-left"
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => setIsEditMode(!isEditMode)}
                      style={[styles.button, styles.modeButton]}
                      icon={isEditMode ? "eye" : "pencil"}
                    >
                      {isEditMode ? 'Preview' : 'Edit'}
                    </Button>
                  </View>
                  {!isEditMode && (
                    <Button
                      mode="contained"
                      onPress={handleSave}
                      loading={loading}
                      style={[styles.submitButton]}
                      contentStyle={styles.buttonContent}
                    >
                      Complete Profile
                    </Button>
                  )}
                </View>
                <Copyright />
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
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
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  uploadButton: {
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    flex: 1,
    marginLeft: 8,
    color: '#333',
  },
  sectionContent: {
    padding: 16,
    borderRadius: 8,
    overflow: 'hidden',

  },
  inputGroup: {
    padding: 16,
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  submitButton: {
    borderRadius: 8,
    backgroundColor: '#6949FF',
    height: 48,
  },
  buttonContent: {
    height: 48,
  },
  overlayAvatar: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  licenseButtons: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  documentSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  documentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  documentButton: {
    flex: 1,
  },
  documentUploaded: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionSurface: {
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionInner: {
    padding: 16,
  },
  sectionContentWrapper: {
    overflow: 'hidden',
  },
  sectionEditing: {
    borderColor: '#6949FF',
    borderWidth: 2,
  },
  editButton: {
    marginRight: -8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  actionButtonsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
  },
  cancelButton: {
    borderColor: '#6949FF',
  },
  modeButton: {
    borderColor: '#6949FF',
  },
  driverTypeButtons: {
    marginBottom: 16,
  },
  skillsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 16,
  },
  skillChip: {
    marginBottom: 8,
  },
  experienceInput: {
    minHeight: 120,
  },
});
