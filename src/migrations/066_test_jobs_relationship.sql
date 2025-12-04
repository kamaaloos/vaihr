-- Test the foreign key relationship
DO $$ 
DECLARE
    v_result INTEGER;
BEGIN
    -- Try to insert a job with a valid admin_id
    BEGIN
        INSERT INTO public.jobs (title, admin_id, status)
        VALUES ('Test Job', (SELECT id FROM auth.users LIMIT 1), 'open')
        RETURNING id;
        
        RAISE NOTICE 'Successfully inserted job with valid admin_id';
        
        -- Clean up
        DELETE FROM public.jobs WHERE title = 'Test Job';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to insert job with valid admin_id: %', SQLERRM;
    END;
    
    -- Try to insert a job with an invalid admin_id
    BEGIN
        INSERT INTO public.jobs (title, admin_id, status)
        VALUES ('Invalid Job', '00000000-0000-0000-0000-000000000000', 'open');
        
        RAISE NOTICE 'ERROR: Should not be able to insert job with invalid admin_id';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'Successfully prevented insertion of job with invalid admin_id';
    END;
    
    -- Test the join
    BEGIN
        SELECT COUNT(*) INTO v_result
        FROM public.jobs j
        JOIN auth.users u ON j.admin_id = u.id;
        
        RAISE NOTICE 'Successfully joined jobs with auth.users';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to join jobs with auth.users: %', SQLERRM;
    END;
END $$; 