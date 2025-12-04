# Vaihtoratti Mobile App

A React Native mobile application for driver job management, built with Expo and Firebase.

## Features

- User authentication (Driver/Admin roles)
- Job posting and management for admins
- Real-time job listings for drivers
- Job acceptance/decline functionality
- Status tracking (New, Processing, Completed)
- Push notifications for new jobs

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- Firebase account

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd vaihtoratti-mobile
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Configure Firebase:

   - Create a new Firebase project
   - Enable Authentication and Firestore
   - Copy your Firebase configuration from the Firebase Console
   - Update the configuration in `src/config/firebase.ts`

4. Start the development server:

```bash
npm start
# or
yarn start
```

5. Run on your device:
   - Install the Expo Go app on your mobile device
   - Scan the QR code from the terminal
   - Or run on an emulator using the Expo CLI commands

## Project Structure

```
src/
├── config/
│   └── firebase.ts
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── AdminHomeScreen.tsx
│   ├── DriverHomeScreen.tsx
│   └── JobDetailsScreen.tsx
└── types/
    └── index.ts
```

## Firebase Collections

### Users Collection

```typescript
{
  id: string;
  email: string;
  role: 'admin' | 'driver';
  name: string;
  phoneNumber?: string;
}
```

### Jobs Collection

```typescript
{
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  status: 'new' | 'processing' | 'completed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
