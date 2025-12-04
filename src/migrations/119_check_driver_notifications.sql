-- Diagnostic script to check notifications for a specific driver
-- Replace the user_id below with the actual driver's user_id

-- 1. Check if there are any notifications in the database
SELECT 
    'Total Notifications' as check_type,
    COUNT(*) as count
FROM notifications;

-- 2. Check notifications for the specific user
-- Replace 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47' with the actual user_id
SELECT 
    'User Notifications' as check_type,
    id,
    user_id,
    title,
    message,
    type,
    read,
    created_at
FROM notifications
WHERE user_id = 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if the user exists and their role
SELECT 
    'User Info' as check_type,
    id,
    email,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users
WHERE id = 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47';

-- 4. Check if the user is in the users table
SELECT 
    'Users Table Entry' as check_type,
    id,
    name,
    email,
    role,
    created_at
FROM users
WHERE id = 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47';

-- 5. Check if the user has online status
SELECT 
    'User Status' as check_type,
    user_id,
    is_online,
    last_seen,
    updated_at
FROM user_status
WHERE user_id = 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47';

-- 6. Check recent jobs to see if any should have triggered notifications
SELECT 
    'Recent Jobs' as check_type,
    id,
    title,
    status,
    created_at,
    created_by
FROM jobs
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check if notifications were created for recent jobs
SELECT 
    'Job Notifications Check' as check_type,
    n.id as notification_id,
    n.user_id,
    n.title,
    n.type,
    n.created_at,
    j.id as job_id,
    j.title as job_title,
    j.created_at as job_created_at
FROM notifications n
LEFT JOIN jobs j ON (n.data->>'jobId')::uuid = j.id
ORDER BY n.created_at DESC
LIMIT 10;


