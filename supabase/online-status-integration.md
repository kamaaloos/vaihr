# Online Status Integration Guide

## Overview
This guide shows how to integrate the online status system into your React Native/Flutter app using the database triggers we've set up.

## How It Works
1. **Database Triggers**: When you update `user_status.is_online`, it automatically syncs to `users.online`
2. **App Integration**: Your app only needs to update `user_status` table
3. **Real-time**: Changes are reflected immediately in both tables

## Implementation Steps

### 1. Authentication Integration

#### Login (set user online)
```javascript
// When user successfully logs in
const setUserOnline = async (userId) => {
  const { data, error } = await supabase
    .from('user_status')
    .upsert({
      user_id: userId,
      is_online: true,
      platform: 'mobile', // or 'web', 'desktop'
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  
  if (error) {
    console.error('Failed to set user online:', error);
  } else {
    console.log('User is now online');
  }
};
```

#### Logout (set user offline)
```javascript
// When user logs out
const setUserOffline = async (userId) => {
  const { data, error } = await supabase
    .from('user_status')
    .update({
      is_online: false,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
  
  if (error) {
    console.error('Failed to set user offline:', error);
  } else {
    console.log('User is now offline');
  }
};
```

### 2. App Lifecycle Integration

#### App State Changes (React Native)
```javascript
import { AppState } from 'react-native';

// In your main App component or auth context
useEffect(() => {
  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      // App came to foreground
      setUserOnline(currentUserId);
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background
      setUserOffline(currentUserId);
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    AppState.removeEventListener('change', handleAppStateChange);
  };
}, [currentUserId]);
```

#### Flutter App Lifecycle
```dart
import 'package:flutter/widgets.dart';

class AppLifecycleManager extends StatefulWidget {
  final Widget child;
  final String userId;
  
  AppLifecycleManager({required this.child, required this.userId});
  
  @override
  _AppLifecycleManagerState createState() => _AppLifecycleManagerState();
}

class _AppLifecycleManagerState extends State<AppLifecycleManager> 
    with WidgetsBindingObserver {
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        // App came to foreground
        setUserOnline(widget.userId);
        break;
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        // App went to background
        setUserOffline(widget.userId);
        break;
      default:
        break;
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
```

### 3. Real-time Status Monitoring

#### Subscribe to Online Status Changes
```javascript
// Subscribe to real-time changes in user_status
const subscribeToOnlineStatus = (userId) => {
  const subscription = supabase
    .channel('online_status')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_status',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Online status changed:', payload);
        // Update your app state here
      }
    )
    .subscribe();
  
  return subscription;
};
```

#### Get All Online Users
```javascript
// Get list of all online users
const getOnlineUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      email,
      role,
      online,
      user_status (
        platform,
        last_seen
      )
    `)
    .eq('online', true)
    .order('user_status.last_seen', { ascending: false });
  
  if (error) {
    console.error('Failed to get online users:', error);
    return [];
  }
  
  return data || [];
};
```

### 4. Periodic Status Updates

#### Heartbeat (keep user online)
```javascript
// Send periodic updates to keep user marked as online
const startHeartbeat = (userId) => {
  const heartbeatInterval = setInterval(async () => {
    const { error } = await supabase
      .from('user_status')
      .update({
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Heartbeat failed:', error);
    }
  }, 30000); // Update every 30 seconds
  
  return heartbeatInterval;
};

// Stop heartbeat when user goes offline
const stopHeartbeat = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
};
```

### 5. Complete Integration Example

```javascript
// Complete online status manager
class OnlineStatusManager {
  constructor(userId) {
    this.userId = userId;
    this.heartbeatInterval = null;
    this.subscription = null;
  }
  
  async initialize() {
    // Set user online
    await this.setOnline();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Subscribe to changes
    this.subscribeToChanges();
  }
  
  async setOnline() {
    const { error } = await supabase
      .from('user_status')
      .upsert({
        user_id: this.userId,
        is_online: true,
        platform: 'mobile',
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
  
  async setOffline() {
    const { error } = await supabase
      .from('user_status')
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', this.userId);
    
    if (error) throw error;
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateLastSeen();
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 30000);
  }
  
  async updateLastSeen() {
    const { error } = await supabase
      .from('user_status')
      .update({
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', this.userId);
    
    if (error) throw error;
  }
  
  subscribeToChanges() {
    this.subscription = supabase
      .channel('online_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => {
          console.log('Status changed:', payload);
        }
      )
      .subscribe();
  }
  
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

// Usage in your app
const onlineManager = new OnlineStatusManager(userId);

// On login
await onlineManager.initialize();

// On logout
await onlineManager.setOffline();
onlineManager.cleanup();
```

## Testing Your Integration

1. **Test Login**: Call `setUserOnline(userId)` and check both tables
2. **Test Logout**: Call `setUserOffline(userId)` and verify user goes offline
3. **Test App Background**: Put app in background and check status
4. **Test Real-time**: Open multiple devices and watch status changes

## Troubleshooting

### Common Issues:
1. **User not going online**: Check if `user_status` record exists
2. **Status not syncing**: Verify triggers are enabled
3. **Permission errors**: Check RLS policies
4. **Real-time not working**: Ensure Supabase client is configured correctly

### Debug Queries:
```sql
-- Check if triggers exist
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%online%';

-- Check current status
SELECT 
    u.id, u.name, u.online as users_online,
    us.is_online as status_online, us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'your-user-id';
```

## Next Steps

1. **Implement in your app**: Use the code examples above
2. **Test thoroughly**: Verify all scenarios work
3. **Monitor performance**: Watch for any issues
4. **Add error handling**: Implement proper error recovery
5. **Optimize**: Adjust heartbeat frequency as needed

The triggers handle all the database synchronization automatically, so your app only needs to focus on updating the `user_status` table! 