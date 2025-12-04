-- Test Online Status Logs
-- This script helps verify why admin online status logs might not be showing

-- Step 1: Check current online status for all users
SELECT 
    'Current Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY us.last_seen DESC;

-- Step 2: Check which users are actually connected (have recent activity)
SELECT 
    'Recently Active Users' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.is_online,
    us.platform,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE us.last_seen > NOW() - INTERVAL '10 minutes'
ORDER BY us.last_seen DESC;

-- Step 3: Check for any stale online status (users marked online but inactive)
SELECT 
    'Stale Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    us.is_online,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE us.is_online = true 
    AND us.last_seen < NOW() - INTERVAL '5 minutes'
ORDER BY us.last_seen DESC;

-- Step 4: Test setting admin online manually
UPDATE user_status 
SET 
    is_online = true,
    platform = 'mobile',
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)::uuid;

-- Step 5: Check if admin is now online
SELECT 
    'After Admin Online Test' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY us.last_seen DESC;

-- Step 6: Instructions for testing
SELECT 
    'Testing Instructions' as info,
    '1. Login as admin and check console logs' as step1,
    '2. Look for "🚀 startOnlineStatusTracking" logs' as step2,
    '3. Look for "🔄 updateOnlineStatus" logs' as step3,
    '4. Look for "✅ Successfully updated online status" logs' as step4,
    '5. If admin logs are missing, check user ID and session' as step5;

-- Step 7: Check user IDs for debugging
SELECT 
    'User IDs for Debugging' as info,
    id,
    name,
    email,
    role,
    created_at
FROM users 
ORDER BY role, name; 