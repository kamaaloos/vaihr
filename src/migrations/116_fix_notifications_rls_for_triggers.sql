-- Fix Notifications RLS Policies for Trigger Functions
-- The trigger function runs with SECURITY DEFINER, so auth.uid() might be NULL
-- We need a policy that allows the trigger function to insert notifications

-- Drop existing INSERT policy if it's too restrictive
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Create a policy that allows trigger functions (SECURITY DEFINER) to insert notifications
-- SECURITY DEFINER functions run with elevated privileges, but RLS still applies
-- We need to allow authenticated users to insert notifications for any user_id
-- (since the trigger creates notifications for drivers, not the admin who created the job)
CREATE POLICY "Allow notification inserts for triggers"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);  -- Allow authenticated role to insert (trigger runs as authenticated)

-- Also create a policy for service_role (if trigger runs as service role)
CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- Also ensure the existing SELECT and UPDATE policies are correct
-- (These should already exist, but we'll verify they're not too restrictive)

-- Verify policies
SELECT 
    'RLS Policies Check' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Test: Try to insert a notification directly (simulating what trigger does)
DO $$
DECLARE
    v_test_user_id UUID;
    v_test_notification_id UUID;
BEGIN
    -- Get a test user (driver)
    SELECT id INTO v_test_user_id
    FROM users
    WHERE role = 'driver'
    LIMIT 1;

    IF v_test_user_id IS NULL THEN
        RAISE NOTICE 'No driver found for test';
        RETURN;
    END IF;

    -- Try to insert a notification (this simulates what the trigger does)
    BEGIN
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            created_at
        ) VALUES (
            v_test_user_id,
            'Test Notification',
            'Testing RLS policy',
            'test',
            NOW()
        ) RETURNING id INTO v_test_notification_id;

        RAISE NOTICE '✅ SUCCESS: Notification inserted successfully: %', v_test_notification_id;
        
        -- Clean up
        DELETE FROM notifications WHERE id = v_test_notification_id;
        RAISE NOTICE '✅ Test notification cleaned up';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ ERROR: Could not insert notification: % (SQL State: %)', SQLERRM, SQLSTATE;
            RAISE NOTICE '   This means the RLS policy is blocking the trigger function!';
    END;
END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

