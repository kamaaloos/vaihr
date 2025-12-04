-- Test Online Status Verification
-- This script tests the online status verification process

-- Step 1: Check current online status for all users
SELECT 
    'Current Online Status' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_online,
    us.platform,
    us.last_seen,
    us.updated_at
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
ORDER BY u.online DESC, us.last_seen DESC;

-- Step 2: Test setting a user online (simulating app login)
UPDATE user_status 
SET 
    is_online = true,
    platform = 'mobile',
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE role = 'driver' LIMIT 1)::uuid;

-- Step 3: Wait a moment for triggers to process
SELECT pg_sleep(1);

-- Step 4: Check if the trigger worked (users.online should be true)
SELECT 
    'After Setting Online' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = (SELECT id FROM users WHERE role = 'driver' LIMIT 1);

-- Step 5: Test setting user offline (simulating app logout)
UPDATE user_status 
SET 
    is_online = false,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE role = 'driver' LIMIT 1)::uuid;

-- Step 6: Wait a moment for triggers to process
SELECT pg_sleep(1);

-- Step 7: Check if the trigger worked (users.online should be false)
SELECT 
    'After Setting Offline' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = (SELECT id FROM users WHERE role = 'driver' LIMIT 1);

-- Step 8: Test verification query (what the app uses)
SELECT 
    'Verification Query Test' as info,
    us.is_online,
    us.user_id,
    us.platform,
    us.last_seen
FROM user_status us
WHERE user_id = (SELECT id FROM users WHERE role = 'driver' LIMIT 1)::uuid;

-- Step 9: Check for any mismatched records
SELECT 
    'Mismatch Check' as info,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.online = true AND us.is_online = true THEN 1 END) as both_online,
    COUNT(CASE WHEN u.online = false AND us.is_online = false THEN 1 END) as both_offline,
    COUNT(CASE WHEN u.online != us.is_online THEN 1 END) as mismatched,
    COUNT(CASE WHEN us.is_online IS NULL THEN 1 END) as missing_status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text;

-- Step 10: Show any mismatched records
SELECT 
    'Mismatched Records' as info,
    u.id,
    u.name,
    u.email,
    u.online as users_online,
    us.is_online as status_online,
    CASE 
        WHEN u.online != us.is_online THEN 'MISMATCH'
        WHEN us.is_online IS NULL THEN 'MISSING STATUS'
        ELSE 'OK'
    END as status
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.online != us.is_online OR us.is_online IS NULL
ORDER BY u.online DESC;

-- Step 11: Instructions for app testing
SELECT 
    'App Testing Instructions' as info,
    '1. Try logging in with driver account' as step1,
    '2. Check console logs for verification attempts' as step2,
    '3. Verify user goes online in both tables' as step3,
    '4. Try logging out using menu' as step4,
    '5. Verify user goes offline in both tables' as step5,
    '6. Check that navigation works properly' as step6; 