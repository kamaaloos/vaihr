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
import { TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import Toast from 'react-native-toast-message';
import { s, vs, ms, mvs } from '../utils/dimensions';
import Copyright from '../components/Copyright';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        Toast.show({
          type: 'error',
          text1: 'Missing Fields',
          text2: 'Please enter both email and password',
          position: 'bottom',
        });
        return;
      }

      setLoading(true);
      console.log('Attempting login with email:', email);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Email',
          text2: 'Please enter a valid email address',
          position: 'bottom',
        });
        return;
      }

      await signIn(email.toLowerCase().trim(), password);
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Detailed error:', error.message);

      let errorMessage = 'Failed to login';
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please verify your email address if you haven\'t already.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many attempts. Please try again later';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.message.includes('email not confirmed')) {
        errorMessage = 'Please verify your email address before logging in';
      }

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
        position: 'bottom',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };


  const handleForgotPassword = async () => {
    if (!email) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter your email address',
        position: 'bottom',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid email address',
        position: 'bottom',
      });
      return;
    }

    try {
      setResetLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Password reset email has been sent',
        position: 'bottom',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send reset email';
      if (error.message.includes('user not found')) {
        errorMessage = 'No account found with this email';
      } else if (error.message.includes('too many requests')) {
        errorMessage = 'Too many attempts. Please try again later';
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom',
      });
    } finally {
      setResetLoading(false);
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
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.container}>
                <View style={styles.header}>
                  <Text style={styles.welcomeText}>Welcome Back</Text>
                  <Image
                    source={require('../assets/login-illustration.png')}
                    style={styles.illustration}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.formContainer}>

                  <TextInput
                    label="Email Address"
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    outlineColor="transparent"
                    activeOutlineColor="#6949FF"
                    textColor="#333"
                    placeholderTextColor="#666"
                    left={<TextInput.Icon icon="email" color="#666" />}
                    theme={{
                      colors: {
                        background: '#fff',
                        primary: '#6949FF',
                      },
                    }}
                  />

                  <TextInput
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    outlineColor="transparent"
                    activeOutlineColor="#6949FF"
                    textColor="#333"
                    placeholderTextColor="#666"
                    left={<TextInput.Icon icon="lock" color="#666" />}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? "eye-off" : "eye"}
                        onPress={() => setShowPassword(!showPassword)}
                        color="#666"
                      />
                    }
                    theme={{
                      colors: {
                        background: '#fff',
                        primary: '#6949FF',
                      },
                    }}
                  />

                  <TouchableWithoutFeedback onPress={handleForgotPassword} disabled={resetLoading}>
                    <View style={styles.forgotPasswordContainer}>
                      <Text style={styles.forgotPasswordText}>
                        {resetLoading ? 'Sending reset email...' : 'Do you forget your password?'}
                      </Text>
                    </View>
                  </TouchableWithoutFeedback>

                  <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    style={styles.loginButton}
                    contentStyle={styles.loginButtonContent}
                    labelStyle={styles.loginButtonLabel}
                  >
                    Sign In
                  </Button>

                  <View style={styles.registerContainer}>
                    <Text style={styles.registerText}>Don't have an account? </Text>
                    <Text
                      style={styles.registerLink}
                      onPress={() => navigation.navigate('Register')}
                    >
                      Sign Up
                    </Text>
                  </View>
                  <Copyright />
                </View>
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
    paddingBottom: mvs(24),
  },
  container: {
    flex: 1,
    paddingHorizontal: s(24),
  },
  header: {
    alignItems: 'center',
    marginTop: mvs(isSmallDevice ? 20 : 40),
    marginBottom: mvs(24),
  },
  welcomeText: {
    fontSize: ms(28),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: mvs(16),
  },
  illustration: {
    width: s(isSmallDevice ? 200 : 250),
    height: vs(isSmallDevice ? 150 : 200),
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: ms(16),
    padding: ms(20),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  input: {
    marginBottom: mvs(16),
    backgroundColor: '#fff',
    borderRadius: ms(8),
    height: vs(isSmallDevice ? 48 : 56),
    fontSize: ms(14),
  },
  loginButton: {
    backgroundColor: '#6949FF',
    borderRadius: ms(8),
    marginBottom: mvs(16),
    elevation: 2,
    height: vs(isSmallDevice ? 48 : 56),
  },
  loginButtonContent: {
    height: '100%',
  },
  loginButtonLabel: {
    fontSize: ms(16),
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: mvs(16),
  },
  registerText: {
    color: '#666',
    fontSize: ms(14),
  },
  registerLink: {
    color: '#6949FF',
    fontWeight: 'bold',
    fontSize: ms(14),
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: mvs(16),
  },
  forgotPasswordText: {
    color: '#6949FF',
    fontSize: ms(14),
    fontWeight: '500',
  },
}); 