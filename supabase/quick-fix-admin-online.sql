-- Quick Fix: Set Admin Online
-- Run this to quickly fix the admin online status

-- Set admin user to online in user_status table
INSERT INTO user_status (
    user_id,
    is_online,
    platform,
    last_seen,
    created_at,
    updated_at
)
VALUES (
    'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
    true,
    'web',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW();

-- Set admin user to online in users table (if online column exists)
UPDATE users 
SET online = true
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa';

-- Set all admin users to online
UPDATE user_status 
SET 
    is_online = true,
    platform = 'web',
    last_seen = NOW(),
    updated_at = NOW()
FROM users u
WHERE user_status.user_id::text = u.id
    AND u.role = 'admin';

UPDATE users 
SET online = true
WHERE role = 'admin';

-- Verify the fix
SELECT 
    'Admin Online Status Fixed' as info,
    u.name,
    u.role,
    us.is_online as status_online,
    u.online as users_online
FROM users u
LEFT JOIN user_status us ON u.id = us.user_id::text
WHERE u.role = 'admin'; 