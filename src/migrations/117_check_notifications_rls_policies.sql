-- Check Existing RLS Policies for Notifications Table
-- This script shows what RLS policies currently exist before making changes

-- 1. Check if RLS is enabled on notifications table
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'notifications';

-- 2. Show all RLS policies on notifications table
SELECT 
    'Current RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 3. Show policies in a more readable format
SELECT 
    'Policy Summary' as check_type,
    policyname as policy_name,
    CASE 
        WHEN cmd = 'SELECT' THEN 'READ'
        WHEN cmd = 'INSERT' THEN 'CREATE'
        WHEN cmd = 'UPDATE' THEN 'UPDATE'
        WHEN cmd = 'DELETE' THEN 'DELETE'
        WHEN cmd = 'ALL' THEN 'ALL OPERATIONS'
        ELSE cmd
    END as operation,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN 'ALLOWS'
        WHEN permissive = 'RESTRICTIVE' THEN 'RESTRICTS'
        ELSE permissive
    END as policy_type,
    roles as applies_to_roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- 4. Show the actual policy expressions (for INSERT policies specifically)
SELECT 
    'INSERT Policy Details' as check_type,
    policyname,
    roles,
    qual as using_expression,
    with_check as with_check_expression,
    CASE 
        WHEN with_check = 'true' OR with_check IS NULL THEN '✅ Allows all inserts'
        WHEN with_check LIKE '%auth.uid()%' AND with_check LIKE '%user_id%' THEN '⚠️ Requires auth.uid() = user_id (may block triggers)'
        ELSE '⚠️ Has restrictions: ' || with_check
    END as policy_analysis
FROM pg_policies
WHERE tablename = 'notifications'
AND cmd = 'INSERT'
ORDER BY policyname;

-- 5. Test current policy by trying to insert a notification
DO $$
DECLARE
    v_test_user_id UUID;
    v_test_notification_id UUID;
    v_error_message TEXT;
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

    RAISE NOTICE 'Testing RLS policy by inserting notification for user: %', v_test_user_id;
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
            'RLS Policy Test',
            'Testing if current policy allows this insert',
            'test',
            NOW()
        ) RETURNING id INTO v_test_notification_id;

        RAISE NOTICE '✅ SUCCESS: Notification inserted successfully: %', v_test_notification_id;
        RAISE NOTICE '   This means the current RLS policy ALLOWS inserts';
        
        -- Clean up
        DELETE FROM notifications WHERE id = v_test_notification_id;
        RAISE NOTICE '✅ Test notification cleaned up';
        
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE '❌ ERROR: Insufficient privilege - RLS policy is blocking the insert';
            RAISE NOTICE '   This is likely why the trigger is not creating notifications!';
        WHEN OTHERS THEN
            v_error_message := SQLERRM;
            RAISE NOTICE '❌ ERROR: Could not insert notification: % (SQL State: %)', v_error_message, SQLSTATE;
            RAISE NOTICE '   Error Code: %', SQLSTATE;
            IF v_error_message LIKE '%policy%' OR v_error_message LIKE '%row-level security%' THEN
                RAISE NOTICE '   ⚠️ This error is related to RLS policies!';
            END IF;
    END;
END $$;

-- 6. Check what role we're running as
SELECT 
    'Current Role' as check_type,
    current_user as current_user_role,
    session_user as session_user_role,
    current_setting('role') as current_role_setting;

