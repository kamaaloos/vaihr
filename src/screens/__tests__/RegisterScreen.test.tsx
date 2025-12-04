import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';
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

describe('RegisterScreen', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Check if important elements are rendered
    expect(getByText('Full Name')).toBeTruthy();
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('Password')).toBeTruthy();
    expect(getByText('Confirm Password')).toBeTruthy();
    expect(getByText('Create Account')).toBeTruthy();
  });

  it('shows error when passwords do not match', async () => {
    const { getByText, getByLabelText } = render(
      <NavigationContainer>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Fill in form with mismatched passwords
    fireEvent.changeText(getByLabelText('Password'), 'password123');
    fireEvent.changeText(getByLabelText('Confirm Password'), 'password456');
    
    // Try to submit form
    fireEvent.press(getByText('Create Account'));

    // Wait for error message
    await waitFor(() => {
      expect(require('react-native-toast-message').show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Passwords do not match',
        })
      );
    });
  });

  it('shows error when terms are not accepted', async () => {
    const { getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Try to submit form without accepting terms
    fireEvent.press(getByText('Create Account'));

    // Wait for error message
    await waitFor(() => {
      expect(require('react-native-toast-message').show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Please accept the Terms of Service',
        })
      );
    });
  });

  it('navigates to login screen', () => {
    const { getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Press the login link
    fireEvent.press(getByText(/Already have an account\? Login/));

    // Check if navigation was called
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to terms of service', () => {
    const { getByText } = render(
      <NavigationContainer>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation as any} />
        </AuthProvider>
      </NavigationContainer>
    );

    // Press the terms link
    fireEvent.press(getByText('Terms of Service'));

    // Check if navigation was called
    expect(mockNavigation.navigate).toHaveBeenCalledWith('TermsOfService');
  });

  // Add more test cases as needed
}); 