import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { AuthProvider } from '../../contexts/AuthContext';
import { NavigationContainer } from '@react-navigation/native';

// Mock the navigation prop
const mockNavigation = {
  navigate: jest.fn(),
};

// Mock the Toast component
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <LoginScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Check if important elements are rendered
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('shows error when submitting empty form', async () => {
    const { getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <LoginScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Try to submit empty form
    fireEvent.press(getByText('Sign In'));

    // Wait for error message
    await waitFor(() => {
      expect(require('react-native-toast-message').show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Please fill in all fields',
        })
      );
    });
  });

  it('navigates to register screen', () => {
    const { getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <LoginScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Press the register link
    fireEvent.press(getByText('Sign Up'));

    // Check if navigation was called
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });

  // Add more test cases as needed
}); 