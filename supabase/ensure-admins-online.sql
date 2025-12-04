-- Ensure all admins are online in user_status and users tables
INSERT INTO user_status (user_id, is_online, platform, last_seen, created_at, updated_at)
SELECT id::uuid, true, 'web', NOW(), NOW(), NOW()
FROM users
WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE
SET is_online = true, platform = 'web', last_seen = NOW(), updated_at = NOW();

UPDATE users SET online = true WHERE role = 'admin';

-- Verify
SELECT id, name, role, online FROM users WHERE role = 'admin';
SELECT user_id, is_online, last_seen FROM user_status WHERE user_id IN (SELECT id FROM users WHERE role = 'admin'); 