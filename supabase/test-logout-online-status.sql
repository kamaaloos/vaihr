-- Test Logout Online Status
-- This script tests if the online status is properly updated during logout

-- Step 1: Check current online status
SELECT 
    'Current Online Status Before Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 2: Test setting user offline (simulating logout)
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 3: Check if the trigger worked (users.online should be false)
SELECT 
    'After Setting Offline Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 4: Test setting user online (simulating login)
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 5: Check if the trigger worked (users.online should be true)
SELECT 
    'After Setting Online Test' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 6: Show final status for all users
SELECT 
    'Final Status for All Users' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 7: Instructions for app testing
SELECT 
    'App Testing Instructions' as info,
    '1. Try logging in with admin account' as step1,
    '2. Check that user goes online in both tables' as step2,
    '3. Try logging out using the drawer menu' as step3,
    '4. Check that user goes offline in both tables' as step4,
    '5. Verify navigation to Welcome screen' as step5; 