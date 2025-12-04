-- App Integration Examples
-- These are examples of how to use the triggers in your application code

-- ===========================================
-- EXAMPLE 1: User Login (React Native/Flutter)
-- ===========================================

-- When user logs in, update their status to online
-- Replace 'USER_ID_HERE' with the actual user ID from your auth system

UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- The trigger will automatically set users.online = true

-- ===========================================
-- EXAMPLE 2: User Logout (React Native/Flutter)
-- ===========================================

-- When user logs out, update their status to offline
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- The trigger will automatically set users.online = false

-- ===========================================
-- EXAMPLE 3: New User First Connection
-- ===========================================

-- When a new user connects for the first time
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid,
    true,
    'mobile',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW();

-- The trigger will automatically set users.online = true

-- ===========================================
-- EXAMPLE 4: App Background/Foreground (Mobile)
-- ===========================================

-- When app goes to background
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- When app comes to foreground
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- ===========================================
-- EXAMPLE 5: Check User Online Status
-- ===========================================

-- To check if a user is online
SELECT 
    u.id,
    u.name,
    u.online as is_online,
    us.last_seen,
    us.platform
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b';

-- ===========================================
-- EXAMPLE 6: Get All Online Users
-- ===========================================

-- To get all currently online users
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online = true 
    AND us.is_online = true
ORDER BY us.last_seen DESC;

-- ===========================================
-- EXAMPLE 7: Cleanup Function
-- ===========================================

-- If you need to sync all users (for cleanup)
SELECT sync_all_online_status();

-- ===========================================
-- JAVASCRIPT/REACT NATIVE EXAMPLES
-- ===========================================

/*
// Example JavaScript/React Native code:

// Login
const loginUser = async (userId) => {
  const { data, error } = await supabase
    .from('user_status')
    .upsert({
      user_id: userId,
      is_online: true,
      platform: 'mobile',
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  
  if (error) console.error('Login error:', error);
};

// Logout
const logoutUser = async (userId) => {
  const { data, error } = await supabase
    .from('user_status')
    .update({
      is_online: false,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
  
  if (error) console.error('Logout error:', error);
};

// Check online status
const checkOnlineStatus = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('online, user_status(last_seen, platform)')
    .eq('id', userId)
    .single();
  
  return data?.online || false;
};
*/ 