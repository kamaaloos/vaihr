-- Comprehensive Notification System Diagnosis
-- Run this in the Supabase SQL Editor to identify why notifications are showing 0

-- 1. Check if notifications table exists and has data
SELECT 
    'Notifications Table Status' as check_type,
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_notifications,
    COUNT(CASE WHEN read = false THEN 1 END) as unread_notifications
FROM notifications;

-- 2. Check if triggers exist and are enabled
SELECT 
    'Trigger Status' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    tgenabled as enabled
FROM information_schema.triggers 
JOIN pg_trigger ON information_schema.triggers.trigger_name = pg_trigger.tgname
WHERE trigger_name LIKE '%notification%'
ORDER BY trigger_name;

-- 3. Check if functions exist and are valid
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%notification%'
ORDER BY routine_name;

-- 4. Check users table structure and data
SELECT 
    'Users Table Status' as check_type,
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'driver' THEN 1 END) as drivers,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
    COUNT(CASE WHEN role = 'driver' AND online_status = 'online' THEN 1 END) as online_drivers
FROM users;

-- 5. Check jobs table for recent activity
SELECT 
    'Jobs Table Status' as check_type,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_jobs,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recently_updated_jobs,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_jobs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs
FROM jobs;

-- 6. Check specific admin user (from your SQL file)
SELECT 
    'Admin User Check' as check_type,
    id,
    name,
    email,
    role,
    online_status,
    expo_push_token IS NOT NULL as has_push_token
FROM users 
WHERE id = 'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid;

-- 7. Check recent notifications with details
SELECT 
    'Recent Notifications Detail' as check_type,
    id,
    title,
    message,
    type,
    user_id,
    read,
    created_at
FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 8. Test direct notification insert (bypass trigger)
DO $$
DECLARE
    test_notification_id UUID;
BEGIN
    RAISE NOTICE '=== TESTING DIRECT NOTIFICATION INSERT ===';
    
    -- Try to insert a test notification directly
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data,
        created_at
    ) VALUES (
        'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
        'Test Notification',
        'Testing direct insert to verify table permissions',
        'test',
        '{"test": true}'::jsonb,
        NOW()
    ) RETURNING id INTO test_notification_id;
    
    RAISE NOTICE '✅ Direct notification insert successful: %', test_notification_id;
    
    -- Clean up test notification
    DELETE FROM notifications WHERE id = test_notification_id;
    RAISE NOTICE '🧹 Test notification cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Direct notification insert failed: %', SQLERRM;
END $$;

-- 9. Check if there are any recent job status changes that should have triggered notifications
SELECT 
    'Recent Job Status Changes' as check_type,
    id,
    title,
    status,
    admin_id,
    driver_id,
    created_at,
    updated_at
FROM jobs 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- 10. Check RLS policies on notifications table
SELECT 
    'RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications'; 