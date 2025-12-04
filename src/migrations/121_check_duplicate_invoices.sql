-- Diagnostic script to check for duplicate invoices
-- This helps identify why there are two similar invoices (one pending, one paid)

-- 1. Check for invoices with the same job_id (should only be one per job)
SELECT 
    'Duplicate Invoices by Job' as check_type,
    job_id,
    COUNT(*) as invoice_count,
    STRING_AGG(id::text, ', ') as invoice_ids,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(invoice_number, ', ') as invoice_numbers,
    STRING_AGG(created_at::text, ' | ') as created_dates
FROM invoices
GROUP BY job_id
HAVING COUNT(*) > 1
ORDER BY invoice_count DESC;

-- 2. Show all invoices for jobs with duplicates
SELECT 
    'All Invoices for Duplicate Jobs' as check_type,
    i.id,
    i.invoice_number,
    i.job_id,
    i.driver_id,
    i.admin_id,
    i.amount,
    i.status,
    i.created_at,
    i.updated_at,
    j.title as job_title,
    j.status as job_status
FROM invoices i
JOIN jobs j ON i.job_id = j.id
WHERE i.job_id IN (
    SELECT job_id
    FROM invoices
    GROUP BY job_id
    HAVING COUNT(*) > 1
)
ORDER BY i.job_id, i.created_at;

-- 3. Check if there's a unique constraint on job_id
SELECT 
    'Unique Constraints on Invoices' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'invoices'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_type, kcu.column_name;

-- 4. Check the complete_job_and_create_invoice function for duplicate prevention
SELECT 
    'Function Definition' as check_type,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'complete_job_and_create_invoice'
    AND routine_schema = 'public';


