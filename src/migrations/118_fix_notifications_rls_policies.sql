-- Fix Notifications RLS Policies for Trigger Functions
-- The current policies have conflicts - we need to ensure triggers can insert notifications

-- 1. First, show current policies
SELECT 
    'Before Fix - Current Policies' as check_type,
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- 2. Drop the restrictive "System can create notifications" policy
-- This policy requires auth.uid() = user_id, which blocks triggers
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- 3. Keep "Admins can create notifications" (for admin manual inserts)
-- This one is fine as-is

-- 4. Ensure "Authenticated users can insert notifications" exists and allows all
-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);  -- Allow all authenticated inserts (including from triggers)

-- 5. Also ensure service_role can insert (for background jobs/triggers)
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. Show updated policies
SELECT 
    'After Fix - Updated Policies' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN with_check = 'true' THEN '✅ Allows all inserts'
        WHEN with_check LIKE '%auth.uid()%' AND with_check LIKE '%user_id%' THEN '⚠️ Restrictive'
        ELSE '⚠️ Has restrictions'
    END as policy_status
FROM pg_policies
WHERE tablename = 'notifications'
AND cmd = 'INSERT'
ORDER BY policyname;

-- 7. Test the fix by trying to insert a notification
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

    RAISE NOTICE 'Testing RLS policy fix...';
    RAISE NOTICE 'Attempting to insert notification for driver: %', v_test_user_id;
    RAISE NOTICE 'Current auth.uid(): %', auth.uid();

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
            'RLS Policy Fix Test',
            'Testing if the fixed policy allows this insert',
            'test',
            NOW()
        ) RETURNING id INTO v_test_notification_id;

        RAISE NOTICE '✅ SUCCESS: Notification inserted successfully: %', v_test_notification_id;
        RAISE NOTICE '   The RLS policy fix is working!';
        
        -- Clean up
        DELETE FROM notifications WHERE id = v_test_notification_id;
        RAISE NOTICE '✅ Test notification cleaned up';
        
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE '❌ ERROR: Insufficient privilege - RLS policy is still blocking';
        WHEN OTHERS THEN
            RAISE NOTICE '❌ ERROR: Could not insert notification: % (SQL State: %)', SQLERRM, SQLSTATE;
    END;
END $$;

-- 8. Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- 9. Final summary
SELECT 
    'Fix Summary' as check_type,
    'Dropped restrictive "System can create notifications" policy' as action_1,
    'Ensured "Authenticated users can insert notifications" allows all inserts' as action_2,
    'Added "Service role can insert notifications" policy' as action_3,
    'Trigger functions should now be able to create notifications' as result;

