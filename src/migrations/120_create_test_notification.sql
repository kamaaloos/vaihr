-- Create a test notification for a specific driver
-- This helps verify that the NotificationsScreen is working correctly
-- Replace the user_id below with the actual driver's user_id

-- Insert a test notification
INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    read,
    created_at
) VALUES (
    'fb46cc34-37ed-495f-8c3b-e7e7f1885e47',  -- Replace with actual user_id
    'Test Notification',
    'This is a test notification to verify the NotificationsScreen is working correctly.',
    'system',
    false,
    NOW()
)
ON CONFLICT DO NOTHING;

-- Verify the notification was created
SELECT 
    'Test Notification Created' as check_type,
    id,
    user_id,
    title,
    message,
    type,
    read,
    created_at
FROM notifications
WHERE user_id = 'fb46cc34-37ed-495f-8c3b-e7e7f1885e47'  -- Replace with actual user_id
AND title = 'Test Notification'
ORDER BY created_at DESC
LIMIT 1;

