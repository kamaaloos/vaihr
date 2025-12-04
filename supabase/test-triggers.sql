-- Test Online Status Triggers
-- This script shows how to properly test the triggers

-- Step 1: Show current status before testing
SELECT 
    'Before Testing' as info,
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
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 2: Test login trigger (set a user to online)
-- Replace '617e7a07-9a4d-4b92-9465-f8f6f52e910b' with an actual user ID from your database
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- Step 3: Check if the trigger worked (user should now be online in both tables)
SELECT 
    'After Login Test' as info,
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
WHERE u.id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 4: Test logout trigger (set the same user to offline)
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'::uuid;

-- Step 5: Check if the logout trigger worked
SELECT 
    'After Logout Test' as info,
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
WHERE u.id = '617e7a07-9a4d-4b92-9465-f8f6f52e910b'
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 6: Test new user connection (INSERT trigger)
-- This simulates a new user connecting for the first time
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,  -- Replace with actual user ID
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

-- Step 7: Check if the INSERT trigger worked
SELECT 
    'After New Connection Test' as info,
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
WHERE u.id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 8: Show final status of all users
SELECT 
    'Final Status After Testing' as info,
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
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 9: Instructions for app integration
SELECT 
    'App Integration Examples' as info,
    'For your app code, use these patterns:' as instruction,
    '1. Login: UPDATE user_status SET is_online = true WHERE user_id = actual_user_id' as login_example,
    '2. Logout: UPDATE user_status SET is_online = false WHERE user_id = actual_user_id' as logout_example,
    '3. New user: INSERT INTO user_status (user_id, is_online, ...) VALUES (actual_user_id, true, ...)' as new_user_example; 