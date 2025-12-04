-- Quick Test Online Status
-- Run this to immediately test the online status functionality

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 2: Check if triggers exist
SELECT 
    'Triggers' as info,
    trigger_name,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%online%' OR trigger_name LIKE '%user_status%';

-- Step 3: Test manual update
UPDATE user_status 
SET 
    is_online = true,
    last_seen = NOW(),
    updated_at = NOW()
WHERE user_id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'::uuid;

-- Step 4: Check result
SELECT 
    'After Update' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online,
    us.last_seen
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 5: If trigger didn't work, manually update users table
UPDATE users 
SET 
    online = true,
    updated_at = NOW()
WHERE id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1';

-- Step 6: Final check
SELECT 
    'Final Result' as info,
    u.id,
    u.name,
    u.online as users_online,
    us.is_online as status_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.id = '36a28a98-995f-4452-86fa-7d8bcc9ed0f1'; 