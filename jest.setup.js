// Mock setImmediate for React Native
global.setImmediate = jest.fn((callback) => setTimeout(callback, 0));

// Mock requestAnimationFrame
global.requestAnimationFrame = function(callback) {
  return setTimeout(callback, 0);
};

// Mock cancelAnimationFrame
global.cancelAnimationFrame = function(id) {
  clearTimeout(id);
};

// Mock Firebase modules before anything else
jest.mock('firebase/app', () => {
  const mockApp = {
    name: '[DEFAULT]',
    options: {},
    automaticDataCollectionEnabled: false,
    delete: jest.fn()
  };
  return {
    initializeApp: jest.fn(() => mockApp),
    getApps: jest.fn(() => [mockApp]),
    getApp: jest.fn(() => mockApp),
    deleteApp: jest.fn()
  };
});

const mockUnsubscribe = jest.fn();

const mockFirestore = {
  _db: {},
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      id: 'test-doc-id',
      collection: jest.fn(),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
      get: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({
          name: 'Test Driver',
          role: 'driver'
        })
      }))
    })),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    onSnapshot: jest.fn((callback) => {
      callback({
        docs: [],
        size: 0
      });
      return mockUnsubscribe;
    })
  })),
  doc: jest.fn(() => ({
    id: 'test-doc-id',
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => Promise.resolve({
      exists: () => true,
      data: () => ({
        name: 'Test Driver',
        role: 'driver'
      })
    }))
  })),
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({
      name: 'Test Driver',
      role: 'driver'
    })
  })),
  setDoc: jest.fn(() => Promise.resolve()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve())
  })),
  serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  query: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis()
  })),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  onSnapshot: jest.fn((query, callback) => {
    callback({
      docs: [],
      size: 0
    });
    return mockUnsubscribe;
  }),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn(date => ({ seconds: date.getTime() / 1000, nanoseconds: 0 }))
  }
};

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestore),
  collection: jest.fn((db, path) => mockFirestore.collection(path)),
  doc: jest.fn((db, path) => mockFirestore.doc(path)),
  getDoc: mockFirestore.getDoc,
  setDoc: mockFirestore.setDoc,
  writeBatch: jest.fn(() => mockFirestore.writeBatch()),
  serverTimestamp: mockFirestore.serverTimestamp,
  query: mockFirestore.query,
  where: mockFirestore.where,
  orderBy: mockFirestore.orderBy,
  onSnapshot: mockFirestore.onSnapshot,
  Timestamp: mockFirestore.Timestamp
}));

const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'driver'
};

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockUser,
    onAuthStateChanged: jest.fn((callback) => {
      callback(mockUser);
      return mockUnsubscribe;
    })
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(mockUser);
    return mockUnsubscribe;
  }),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: mockUser })),
  signOut: jest.fn(() => Promise.resolve()),
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn()
}));

// Mock the Firebase config module
jest.mock('./src/config/firebase', () => ({
  app: {
    name: '[DEFAULT]',
    options: {},
    automaticDataCollectionEnabled: false
  },
  db: mockFirestore,
  auth: {
    currentUser: mockUser,
    onAuthStateChanged: jest.fn((callback) => {
      callback(mockUser);
      return mockUnsubscribe;
    })
  }
}));

import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key'
      }
    }
  }
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => ({ unsubscribe: jest.fn() })),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
}));

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Button: 'Button',
  TextInput: 'TextInput',
  Text: 'Text',
  ActivityIndicator: 'ActivityIndicator',
  useTheme: () => ({
    colors: {
      primary: '#000',
      background: '#fff',
      surface: '#fff',
      error: '#B00020',
    },
  }),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentState: 'active',
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(dict => dict.ios),
  Version: 42
}));

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Avatar: {
    Image: 'Avatar.Image',
    Text: 'Avatar.Text'
  },
  Button: 'Button',
  Card: {
    Cover: 'Card.Cover',
    Content: 'Card.Content'
  },
  Chip: 'Chip',
  IconButton: 'IconButton',
  Text: 'Text',
  SegmentedButtons: 'SegmentedButtons',
  Badge: 'Badge',
  Surface: 'Surface'
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn()
  }),
  useRoute: () => ({
    params: {
      jobId: 'test-job-id'
    }
  })
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        firebaseConfig: {
          apiKey: 'test-api-key',
          authDomain: 'test-auth-domain',
          projectId: 'test-project-id',
          storageBucket: 'test-storage-bucket',
          messagingSenderId: 'test-messaging-sender-id',
          appId: 'test-app-id'
        }
      }
    }
  }
}));

// Mock AuthContext
jest.mock('./src/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
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

// Mock ThemeContext
jest.mock('./src/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#6949FF',
        background: '#FFFFFF'
      }
    }
  })
})); 