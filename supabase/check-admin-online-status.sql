-- Check Admin Online Status
-- This script will check the specific admin user's online status

-- Step 1: Check the specific admin user's status
SELECT 
    'Admin User Status' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    us.updated_at,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'
ORDER BY us.last_seen DESC;

-- Step 2: Check if admin has a user_status record
SELECT 
    'Admin Status Record' as info,
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
FROM user_status 
WHERE user_id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid;

-- Step 3: Check all admin users
SELECT 
    'All Admin Users' as info,
    u.id,
    u.name,
    u.email,
    u.role,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'
ORDER BY us.last_seen DESC;

-- Step 4: Check recent activity for admin
SELECT 
    'Recent Admin Activity' as info,
    u.id,
    u.name,
    u.email,
    us.is_online,
    us.last_seen,
    EXTRACT(EPOCH FROM (NOW() - us.last_seen))/60 as minutes_since_last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin' 
    AND us.last_seen > NOW() - INTERVAL '1 hour'
ORDER BY us.last_seen DESC; 