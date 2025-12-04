-- Quick Fix for Notifications - Create Test Data
-- Run this in the Supabase SQL Editor to immediately create test notifications

-- Step 1: Check current state
SELECT 
    'Current State' as info,
    (SELECT COUNT(*) FROM users WHERE role = 'driver') as drivers,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins,
    (SELECT COUNT(*) FROM notifications) as total_notifications,
    (SELECT COUNT(*) FROM notifications WHERE read = false) as unread_notifications;

-- Step 2: Create test notifications for existing users
DO $$
DECLARE
    user_record RECORD;
    notification_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== CREATING TEST NOTIFICATIONS ===';
    
    -- Create notifications for all users
    FOR user_record IN 
        SELECT id::text, name, role FROM users 
        WHERE role IN ('driver', 'admin')
        LIMIT 5
    LOOP
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            data,
            created_at
        ) VALUES (
            user_record.id::uuid,
            'Test Notification',
            format('This is a test notification for %s (%s)', user_record.name, user_record.role),
            'test',
            jsonb_build_object(
                'test', true,
                'userRole', user_record.role,
                'timestamp', NOW()
            ),
            NOW()
        );
        
        notification_count := notification_count + 1;
        RAISE NOTICE 'Created notification for user: % (%)', user_record.name, user_record.role;
    END LOOP;
    
    RAISE NOTICE '✅ Created % test notifications', notification_count;
END $$;

-- Step 3: Show the new state
SELECT 
    'After Test Creation' as info,
    (SELECT COUNT(*) FROM notifications) as total_notifications,
    (SELECT COUNT(*) FROM notifications WHERE read = false) as unread_notifications,
    (SELECT COUNT(*) FROM notifications WHERE created_at > NOW() - INTERVAL '5 minutes') as recent_notifications;

-- Step 4: Show recent notifications
SELECT 
    'Recent Notifications' as info,
    id,
    title,
    message,
    type,
    user_id,
    read,
    created_at
FROM notifications 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Step 5: If no users exist, create a test user
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    
    IF user_count = 0 THEN
        RAISE NOTICE 'No users found. Creating test user...';
        
        INSERT INTO users (
            id,
            name,
            email,
            role,
            created_at,
            updated_at
        ) VALUES (
            'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
            'Test Admin',
            'test@example.com',
            'admin',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ Created test admin user';
        
        -- Create notification for the test user
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            data,
            created_at
        ) VALUES (
            'bc9b2d58-65a2-4492-9f5b-cdc242e479fa'::uuid,
            'Welcome!',
            'Welcome to the notification system!',
            'welcome',
            jsonb_build_object('welcome', true),
            NOW()
        );
        
        RAISE NOTICE '✅ Created welcome notification';
    ELSE
        RAISE NOTICE 'Found % existing users', user_count;
    END IF;
END $$;

-- Step 6: Final status check
SELECT 
    'Final Status' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'driver') as drivers,
    (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins,
    (SELECT COUNT(*) FROM notifications) as total_notifications,
    (SELECT COUNT(*) FROM notifications WHERE read = false) as unread_notifications; 