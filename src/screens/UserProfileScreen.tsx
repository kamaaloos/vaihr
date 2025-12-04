import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface, Avatar, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { supabase } from '../config/supabase';
import Copyright from '../components/Copyright';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { getGradientColors, getSurfaceColors } from '../utils/gradientColors';
import { formatDistanceToNow } from 'date-fns';
import { RealtimeChannel } from '@supabase/supabase-js';

type UserProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;
type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

interface UserProfileData {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'driver';
    profileImage?: string;
    phoneNumber?: string;
    address?: {
        street: string;
        city: string;
        state?: string;
        postalCode?: string;
        country?: string;
    };
    companyInfo?: {
        companyName?: string;
        taxId?: string;
        carPlateNumber?: string;
    };
    bankInfo?: {
        accountName?: string;
        accountNumber?: string;
        bankName?: string;
        swiftCode?: string;
    };
    driverType?: 'individual' | 'company';
    skills?: string;
    experience?: string;
    taxiPermitNumber?: string;
    licenseType?: string;
    is_online?: boolean;
    last_seen?: string;
    created_at: string;
    updated_at: string;
}

export default function UserProfileScreen() {
    const navigation = useNavigation<UserProfileScreenNavigationProp>();
    const route = useRoute<UserProfileScreenRouteProp>();
    const { userId, userName, isDriver, isOnline: initialIsOnline, canChat } = route.params;
    const { isDarkMode } = useTheme();
    const gradientColors = getGradientColors(isDarkMode);
    const surfaceColors = getSurfaceColors(isDarkMode);

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOnline, setIsOnline] = useState(initialIsOnline || false);
    const [lastSeen, setLastSeen] = useState<string | null>(null);

    useEffect(() => {
        fetchUserProfile();
        
        // Subscribe to user status changes
        const statusSubscription = supabase
            .channel(`user_status_${userId}`)
            .on(
                'postgres_changes' as 'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_status',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('🔄 UserProfileScreen: User status changed:', payload);
                    if (payload.new) {
                        const newStatus = payload.new as { is_online: boolean; last_seen: string | null };
                        setIsOnline(newStatus.is_online);
                        setLastSeen(newStatus.last_seen);
                    }
                }
            )
            .subscribe() as RealtimeChannel;

        return () => {
            statusSubscription.unsubscribe();
        };
    }, [userId]);

    const fetchUserProfile = async () => {
        try {
            setLoading(true);
            
            // Fetch user data from users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError) {
                console.error('Error fetching user profile:', userError);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to load user profile',
                    position: 'bottom',
                });
                return;
            }

            if (!userData) {
                return;
            }

            // Fetch online status from user_status table
            const { data: statusData, error: statusError } = await supabase
                .from('user_status')
                .select('is_online, last_seen')
                .eq('user_id', userId)
                .single();

            if (statusError && statusError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error fetching user status:', statusError);
            }

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

            // Map database fields (snake_case) to frontend fields (camelCase)
            const mappedData: UserProfileData = {
                id: userData.id,
                name: userData.name || userData.full_name || userName || 'Unknown',
                email: userData.email,
                role: userData.role || 'driver',
                // Map profile_image to profileImage - add cache-bust to force reload
                profileImage: userData.profile_image && typeof userData.profile_image === 'string' 
                    ? `${userData.profile_image.trim()}?t=${Date.now()}`
                    : (userData.profile_image || null),
                phoneNumber: userData.phone_number || null,
                // Map professional fields (snake_case to camelCase)
                taxiPermitNumber: userData.taxi_permit_number || null,
                licenseType: userData.license_type || null,
                skills: userData.skills || null,
                experience: userData.experience || null,
                driverType: userData.driver_type || userData.driverType || null,
                // Map bank_info (snake_case JSONB) to bankInfo (camelCase)
                bankInfo: userData.bank_info ? {
                    accountName: userData.bank_info.account_name || null,
                    accountNumber: userData.bank_info.account_number || null,
                    bankName: userData.bank_info.bank_name || null,
                    swiftCode: userData.bank_info.swift_code || null,
                } : null,
                // Map company_info (snake_case JSONB) to companyInfo (camelCase)
                companyInfo: userData.company_info ? {
                    companyName: userData.company_info.company_name || null,
                    taxId: userData.company_info.tax_id || null,
                    carPlateNumber: userData.company_info.car_plate_number || null,
                } : null,
                // Map address with better handling
                address: mapAddress(userData.address),
                // Online status from user_status table
                is_online: statusData?.is_online ?? false,
                last_seen: statusData?.last_seen || null,
                created_at: userData.created_at,
                updated_at: userData.updated_at,
            };

            setUserProfile(mappedData);
            setIsOnline(statusData?.is_online ?? false);
            setLastSeen(statusData?.last_seen || null);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load user profile',
                position: 'bottom',
            });
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchUserProfile();
        setRefreshing(false);
    };

    const handleChatPress = () => {
        if (canChat && isDriver) {
            navigation.navigate('Chat', {
                driverId: userId,
                driverName: userProfile?.name || userName,
                isOnline: isOnline,
            });
        }
    };

    const getLastSeenText = (lastSeen: string | null | undefined) => {
        if (!lastSeen) return 'Never';
        try {
            return formatDistanceToNow(new Date(lastSeen), { addSuffix: true });
        } catch (e) {
            return 'Unknown';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient colors={gradientColors} style={styles.gradient}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6949FF" />
                        <Text variant="bodyLarge" style={[styles.loadingText, { color: surfaceColors.text }]}>
                            Loading profile...
                        </Text>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    if (!userProfile) {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient colors={gradientColors} style={styles.gradient}>
                    <View style={styles.errorContainer}>
                        <Text variant="headlineSmall" style={[styles.errorTitle, { color: surfaceColors.text }]}>
                            Profile Not Found
                        </Text>
                        <Text variant="bodyLarge" style={[styles.errorText, { color: surfaceColors.textSecondary }]}>
                            The user profile could not be loaded.
                        </Text>
                        <Button
                            mode="contained"
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            Go Back
                        </Button>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={gradientColors} style={styles.gradient}>
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
                                const imageUrl = userProfile.profileImage;
                                const isValidUrl = imageUrl && 
                                    typeof imageUrl === 'string' && 
                                    imageUrl.trim() !== '' &&
                                    (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
                                
                                return isValidUrl ? (
                                    <Avatar.Image
                                        size={100}
                                        source={{ uri: imageUrl.trim() }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <Avatar.Text
                                        size={100}
                                        label={userProfile.name.substring(0, 2).toUpperCase()}
                                        style={styles.avatar}
                                    />
                                );
                            })()}
                            <View style={styles.headerInfo}>
                                <Text variant="headlineSmall" style={[styles.name, { color: surfaceColors.text }]}>
                                    {userProfile.name}
                                </Text>
                                <Text variant="bodyLarge" style={[styles.email, { color: surfaceColors.textSecondary }]}>
                                    {userProfile.email}
                                </Text>
                                <View style={styles.chipContainer}>
                                    <Chip 
                                        icon={userProfile.driverType === 'company' ? 'domain' : 'account'}
                                        style={styles.driverTypeChip}
                                    >
                                        {userProfile.driverType === 'company' ? 'Company Driver' : 'Individual Driver'}
                                    </Chip>
                                    {isDriver && (
                                        <Chip
                                            icon={isOnline ? 'circle' : 'circle-outline'}
                                            style={[
                                                styles.onlineChip,
                                                { backgroundColor: isOnline ? '#4CAF50' : '#757575' }
                                            ]}
                                            textStyle={{ color: 'white' }}
                                        >
                                            {isOnline ? 'Online' : 'Offline'}
                                        </Chip>
                                    )}
                                </View>
                                {isDriver && !isOnline && (
                                    <Text variant="bodySmall" style={[styles.lastSeenText, { color: surfaceColors.textSecondary }]}>
                                        Last seen: {getLastSeenText(lastSeen || userProfile.last_seen)}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </Surface>

                    {canChat && isDriver && (
                        <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
                            <Button
                                mode="contained"
                                icon="message"
                                onPress={handleChatPress}
                                style={styles.chatButton}
                                disabled={!isOnline}
                            >
                                {isOnline ? 'Start Chat' : 'User is Offline'}
                            </Button>
                        </Surface>
                    )}

                    {userProfile.driverType === 'company' ? (
                        userProfile.companyInfo?.companyName && (
                            <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
                                <View style={styles.sectionHeader}>
                                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>
                                        Company Information
                                    </Text>
                                </View>
                                <View style={styles.sectionContent}>
                                    {userProfile.companyInfo.companyName && (
                                        <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>
                                            Company: {userProfile.companyInfo.companyName}
                                        </Text>
                                    )}
                                    {userProfile.companyInfo.taxId && (
                                        <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                            Tax ID: {userProfile.companyInfo.taxId}
                                        </Text>
                                    )}
                                    {userProfile.companyInfo.carPlateNumber && (
                                        <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                            Car Plate: {userProfile.companyInfo.carPlateNumber}
                                        </Text>
                                    )}
                                </View>
                            </Surface>
                        )
                    ) : (
                        (userProfile.taxiPermitNumber || userProfile.licenseType || userProfile.skills || userProfile.experience) && (
                            <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
                                <View style={styles.sectionHeader}>
                                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>
                                        Professional Information
                                    </Text>
                                </View>
                                <View style={styles.sectionContent}>
                                    {userProfile.taxiPermitNumber && (
                                        <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>
                                            Taxi Permit: {userProfile.taxiPermitNumber}
                                        </Text>
                                    )}
                                    {userProfile.licenseType && (
                                        <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                            License Type: {userProfile.licenseType}
                                        </Text>
                                    )}
                                    {userProfile.skills && (
                                        <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                            Skills: {userProfile.skills}
                                        </Text>
                                    )}
                                    {userProfile.experience && (
                                        <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                            Experience: {userProfile.experience}
                                        </Text>
                                    )}
                                </View>
                            </Surface>
                        )
                    )}

                    {userProfile.bankInfo && (userProfile.bankInfo?.accountName || userProfile.bankInfo?.bankName) && (
                        <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>
                                    Bank Information
                                </Text>
                            </View>
                            <View style={styles.sectionContent}>
                                {userProfile.bankInfo.accountName && (
                                    <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>
                                        Account Name: {userProfile.bankInfo.accountName}
                                    </Text>
                                )}
                                {userProfile.bankInfo.bankName && (
                                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                        Bank: {userProfile.bankInfo.bankName}
                                    </Text>
                                )}
                                {userProfile.bankInfo.accountNumber && (
                                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                        Account: ••••{userProfile.bankInfo.accountNumber.slice(-4)}
                                    </Text>
                                )}
                                {userProfile.bankInfo.swiftCode && (
                                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                        SWIFT: {userProfile.bankInfo.swiftCode}
                                    </Text>
                                )}
                            </View>
                        </Surface>
                    )}

                    {(userProfile.phoneNumber || userProfile.address) && (
                        <Surface style={[styles.section, { backgroundColor: surfaceColors.surface }]} elevation={1}>
                            <View style={styles.sectionHeader}>
                                <Text variant="titleMedium" style={[styles.sectionTitle, { color: surfaceColors.text }]}>
                                    Contact Information
                                </Text>
                            </View>
                            <View style={styles.sectionContent}>
                                {userProfile.phoneNumber && (
                                    <Text variant="bodyLarge" style={{ color: surfaceColors.text }}>
                                        Phone: {userProfile.phoneNumber}
                                    </Text>
                                )}
                                {userProfile.address && (
                                    <Text variant="bodyMedium" style={{ color: surfaceColors.textSecondary }}>
                                        {userProfile.address.street}
                                        {userProfile.address.city && `, ${userProfile.address.city}`}
                                        {userProfile.address.state && `, ${userProfile.address.state}`}
                                        {userProfile.address.postalCode && ` ${userProfile.address.postalCode}`}
                                        {userProfile.address.country && `, ${userProfile.address.country}`}
                                    </Text>
                                )}
                            </View>
                        </Surface>
                    )}

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
    scrollContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        marginBottom: 8,
    },
    errorText: {
        textAlign: 'center',
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: '#6949FF',
    },
    header: {
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
    },
    name: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    email: {
        marginBottom: 12,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    driverTypeChip: {
        backgroundColor: '#E3F2FD',
    },
    onlineChip: {
        marginLeft: 0,
    },
    lastSeenText: {
        marginTop: 4,
    },
    section: {
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: 'bold',
    },
    sectionContent: {
        gap: 8,
    },
    chatButton: {
        backgroundColor: '#6949FF',
    },
});
