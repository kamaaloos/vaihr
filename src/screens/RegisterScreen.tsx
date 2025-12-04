import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Text,
    TouchableWithoutFeedback,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions
} from 'react-native';
import { TextInput, Button, SegmentedButtons, Checkbox } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Toast from 'react-native-toast-message';
import { s, vs, ms } from '../utils/dimensions';
import Copyright from '../components/Copyright';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
    const { signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'driver'>('driver');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Inline validation errors
    const [errors, setErrors] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        terms: ''
    });

    // Clear errors when user starts typing
    const clearError = (field: keyof typeof errors) => {
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    // Validation functions
    const validateName = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return 'Name is required';
        if (trimmed.length < 2) return 'Name must be at least 2 characters';
        return '';
    };

    const validateEmail = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) return 'Please enter a valid email address';
        return '';
    };


    const validatePassword = (value: string) => {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        // Stronger password validation
        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;
        if (!passwordRegex.test(value)) {
            return 'Password must include uppercase, number, and symbol';
        }
        return '';
    };

    const validateConfirmPassword = (value: string) => {
        if (!value) return 'Please confirm your password';
        if (value !== password) return 'Passwords do not match';
        return '';
    };

    const handleRegister = async () => {
        try {
            // Clear previous errors
            setErrors({
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
                terms: ''
            });

            // Validate all fields
            const nameError = validateName(name);
            const emailError = validateEmail(email);
            const passwordError = validatePassword(password);
            const confirmPasswordError = validateConfirmPassword(confirmPassword);
            const termsError = !acceptedTerms ? 'You must accept the terms to continue' : '';

            // Set errors
            const newErrors = {
                name: nameError,
                email: emailError,
                password: passwordError,
                confirmPassword: confirmPasswordError,
                terms: termsError
            };
            setErrors(newErrors);

            // Check if there are any errors
            const hasErrors = Object.values(newErrors).some(error => error !== '');
            if (hasErrors) {
                Toast.show({
                    type: 'error',
                    text1: 'Validation Error',
                    text2: 'Please fix the errors below',
                    position: 'bottom',
                });
                return;
            }

            setLoading(true);
            const trimmedInvite = inviteCode.trim();
            const configuredCode = (process.env.EXPO_PUBLIC_ADMIN_INVITE_CODE || '').trim();
            const roleToUse: 'driver' | 'admin' = trimmedInvite && configuredCode && trimmedInvite === configuredCode
                ? 'admin'
                : 'driver';

            console.log('Attempting registration with email verification:', { email, role: roleToUse, hasInvite: !!trimmedInvite });

            await signUp(email.toLowerCase().trim(), password, {
                name: name.trim(),
                role: roleToUse,
            });

            Toast.show({
                type: 'success',
                text1: 'Registration Successful',
                text2: 'Please check your email to verify your account before logging in.',
                position: 'bottom',
                visibilityTime: 6000,
            });

            // Navigate back to login
            navigation.navigate('Login');
        } catch (error: any) {
            console.error('Registration error:', error);
            console.error('Detailed error:', error?.message);

            // Improved error handling
            const message = error?.message ?? 'Unknown error occurred';
            let errorMessage = 'Failed to register';

            if (message.includes('email_address_invalid')) {
                errorMessage = 'Please enter a valid email address';
            } else if (message.includes('already registered') || message.includes('already been registered')) {
                errorMessage = 'This email is already registered';
            } else if (message.includes('password')) {
                errorMessage = 'Password must be at least 6 characters';
            } else if (message.includes('network') || message.includes('connection')) {
                errorMessage = 'Network error. Please check your connection';
            } else if (message.includes('rate limit')) {
                errorMessage = 'Too many attempts. Please try again later';
            } else if (message.includes('Database error')) {
                errorMessage = 'Server error. Please try again later';
            }

            Toast.show({
                type: 'error',
                text1: 'Registration Failed',
                text2: errorMessage,
                position: 'bottom',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <LinearGradient
                        colors={['#DAF2FB', '#4083FF']}
                        style={styles.gradient}
                    >
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.container}>
                                <Image
                                    source={require('../../assets/signup.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />

                                <View style={styles.form}>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            label="Full Name"
                                            value={name}
                                            onChangeText={(text) => {
                                                setName(text);
                                                clearError('name');
                                            }}
                                            mode="outlined"
                                            style={styles.input}
                                            autoCapitalize="words"
                                            disabled={loading}
                                            error={!!errors.name}
                                        />
                                        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            label="Email"
                                            value={email}
                                            onChangeText={(text) => {
                                                setEmail(text);
                                                clearError('email');
                                            }}
                                            mode="outlined"
                                            style={styles.input}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            disabled={loading}
                                            error={!!errors.email}
                                        />
                                        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            label="Password"
                                            value={password}
                                            onChangeText={(text) => {
                                                setPassword(text);
                                                clearError('password');
                                            }}
                                            mode="outlined"
                                            style={styles.input}
                                            secureTextEntry={!showPassword}
                                            right={
                                                <TextInput.Icon
                                                    icon={showPassword ? "eye-off" : "eye"}
                                                    onPress={() => setShowPassword(!showPassword)}
                                                />
                                            }
                                            disabled={loading}
                                            error={!!errors.password}
                                        />
                                        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            label="Confirm Password"
                                            value={confirmPassword}
                                            onChangeText={(text) => {
                                                setConfirmPassword(text);
                                                clearError('confirmPassword');
                                            }}
                                            mode="outlined"
                                            style={styles.input}
                                            secureTextEntry={!showConfirmPassword}
                                            right={
                                                <TextInput.Icon
                                                    icon={showConfirmPassword ? "eye-off" : "eye"}
                                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                                />
                                            }
                                            disabled={loading}
                                            error={!!errors.confirmPassword}
                                        />
                                        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                                    </View>

                                    <View style={styles.roleContainer}>
                                        <Text style={styles.roleLabel}>Role</Text>
                                        <SegmentedButtons
                                            value={role}
                                            onValueChange={() => { /* role is fixed to driver */ }}
                                            buttons={[
                                                {
                                                    value: 'driver',
                                                    label: 'Driver',
                                                    icon: 'car',
                                                    style: styles.roleButton,
                                                    labelStyle: styles.roleButtonLabel,
                                                },
                                            ]}
                                            style={styles.roleButtons}
                                            density="high"
                                        />
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            label="Invite Code (optional)"
                                            value={inviteCode}
                                            onChangeText={(text) => setInviteCode(text)}
                                            mode="outlined"
                                            style={styles.input}
                                            autoCapitalize="none"
                                            disabled={loading}
                                        />
                                    </View>

                                    <View style={styles.termsContainer}>
                                        <View style={styles.termsCheckboxContainer}>
                                            <Checkbox
                                                status={acceptedTerms ? 'checked' : 'unchecked'}
                                                onPress={() => {
                                                    setAcceptedTerms(!acceptedTerms);
                                                    clearError('terms');
                                                }}
                                                disabled={loading}
                                                color="#6949FF"
                                            />
                                            <View style={styles.termsTextContainer}>
                                                <Text style={styles.termsText}>
                                                    I accept the{' '}
                                                    <Text
                                                        style={styles.termsLink}
                                                        onPress={() => {
                                                            navigation.navigate('TermsOfService');
                                                        }}
                                                    >
                                                        Terms of Service
                                                    </Text>
                                                    {' '}and{' '}
                                                    <Text
                                                        style={styles.termsLink}
                                                        onPress={() => {
                                                            // Optional: add a PrivacyPolicy screen if available
                                                            // navigation.navigate('PrivacyPolicy');
                                                        }}
                                                    >
                                                        Privacy Policy
                                                    </Text>
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {errors.terms ? (
                                        <Text style={styles.errorText}>{errors.terms}</Text>
                                    ) : null}

                                    <Button
                                        mode="contained"
                                        onPress={handleRegister}
                                        style={styles.registerButton}
                                        loading={loading}
                                        disabled={loading}
                                        buttonColor="#6949FF"
                                    >
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </Button>

                                    <View style={styles.loginContainer}>
                                        <Text style={styles.loginText}>Already have an account? </Text>
                                        <Button
                                            mode="text"
                                            onPress={() => navigation.navigate('Login')}
                                            disabled={loading}
                                            textColor="#6949FF"
                                        >
                                            Sign In
                                        </Button>
                                    </View>
                                </View>

                                <Copyright />
                            </View>
                        </ScrollView>
                    </LinearGradient>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    keyboardAvoid: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    logo: {
        width: isSmallDevice ? 80 : 100,
        height: isSmallDevice ? 80 : 100,
        marginBottom: 20,
    },
    form: {
        width: '100%',
        maxWidth: 400,
    },
    inputContainer: {
        marginBottom: 16,
    },
    input: {
        backgroundColor: 'white',
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 12,
    },
    roleContainer: {
        marginBottom: 16,
    },
    roleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    roleButtons: {
        marginBottom: 8,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        // iOS shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        // Android elevation
        elevation: 2,
    },
    roleButton: {
        backgroundColor: '#F8FAFF',
    },
    roleButtonLabel: {
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    termsCheckboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    termsTextContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
    },
    termsLink: {
        color: '#6949FF',
        textDecorationLine: 'underline',
    },
    termsError: {
        color: 'red',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    registerButton: {
        marginBottom: 16,
        paddingVertical: 8,
    },
    loginContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginText: {
        fontSize: 14,
        color: '#666',
    },
});
