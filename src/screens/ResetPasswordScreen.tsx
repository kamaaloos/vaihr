import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../config/supabase';
import { s, vs, ms, mvs } from '../utils/dimensions';
import Copyright from '../components/Copyright';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
  route: {
    params: {
      email?: string;
    };
  };
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const email = route.params?.email || '';

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter both password fields',
        position: 'bottom',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Password must be at least 6 characters',
        position: 'bottom',
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Passwords do not match',
        position: 'bottom',
      });
      return;
    }

    try {
      setLoading(true);

      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Refresh the session to ensure it's valid
      await supabase.auth.getSession();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Password has been reset successfully',
        position: 'bottom',
      });

      // Navigate to login screen
      navigation.navigate('Login');
    } catch (error: any) {
      console.error('Password reset error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to reset password. The link may have expired.',
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
        style={styles.container}
      >
        <LinearGradient
          colors={['#4A90E2', '#357ABD']}
          style={styles.gradient}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Please enter your new password
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  label="New Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  disabled={loading}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  disabled={loading}
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  }
                />
              </View>

              <Button
                mode="contained"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Reset Password
              </Button>

              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                disabled={loading}
                style={styles.cancelButton}
              >
                Back to Login
              </Button>
            </View>
            <Copyright />
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: s(20),
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: s(24),
    marginBottom: vs(20),
  },
  title: {
    fontSize: ms(28),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: ms(16),
    color: '#666',
    marginBottom: vs(24),
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: vs(16),
  },
  input: {
    backgroundColor: 'white',
  },
  button: {
    marginTop: vs(8),
    marginBottom: vs(12),
  },
  buttonContent: {
    paddingVertical: vs(8),
  },
  cancelButton: {
    marginTop: vs(8),
  },
});

