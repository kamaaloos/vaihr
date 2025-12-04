import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp, onSnapshot, collection, query, where, orderBy, getFirestore } from 'firebase/firestore';
import DriverHomeScreen from '../DriverHomeScreen';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      email: 'test@example.com',
      role: 'driver'
    },
    loading: false,
    isOnline: true
  })
}));

describe('DriverHomeScreen', () => {
  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com'
  };

  const mockUserData = {
    name: 'Test Driver',
    role: 'driver'
  };

  let mockBatch: any;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockBatch = {
      set: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined)
    };
    mockUnsubscribe = jest.fn();

    // Reset all mocks before each test
    (getFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn(),
      doc: jest.fn()
    });
    (writeBatch as jest.Mock).mockReturnValue(mockBatch);
    (onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({ docs: [], size: 0 });
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        <AuthProvider>
          {component}
        </AuthProvider>
      </ThemeProvider>
    );
  };

  it('should fetch and display user data', async () => {
    const { getByText } = renderWithProviders(<DriverHomeScreen navigation={{} as any} />);

    await waitFor(() => {
      expect(getByText('Welcome back,')).toBeTruthy();
      expect(getByText('Test Driver')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('should update online status on mount', async () => {
    renderWithProviders(<DriverHomeScreen navigation={{} as any} />);

    await waitFor(() => {
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should update status periodically', async () => {
    renderWithProviders(<DriverHomeScreen navigation={{} as any} />);

    // Initial update
    await waitFor(() => {
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Reset mock counts
    mockBatch.set.mockClear();
    mockBatch.commit.mockClear();

    // Fast forward 15 seconds
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    // Check for periodic update
    await waitFor(() => {
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should set offline status on unmount', async () => {
    // Setup batch mock to resolve immediately
    mockBatch.commit.mockImplementation(() => Promise.resolve());
    
    const { unmount } = renderWithProviders(<DriverHomeScreen navigation={{} as any} />);

    // Wait for initial mount operations
    await waitFor(() => {
      expect(mockBatch.set).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Clear the mock calls to start fresh for unmount
    mockBatch.set.mockClear();
    mockBatch.commit.mockClear();

    // Unmount and wait for cleanup
    await act(async () => {
      unmount();
      // Wait for any pending promises to resolve
      await Promise.resolve();
    });

    // Verify offline status was set
    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    
    // Verify unsubscribe was called
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle errors when updating status', async () => {
    const error = new Error('Update failed');
    mockBatch.commit.mockRejectedValueOnce(error);
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    renderWithProviders(<DriverHomeScreen navigation={{} as any} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating status:', error);
    }, { timeout: 5000 });

    consoleSpy.mockRestore();
  });
}); 