-- First, drop the view if it exists
DROP VIEW IF EXISTS jobs_with_admin;

-- Create the jobs_with_admin view using a subquery to handle potential column conflicts
CREATE VIEW jobs_with_admin AS
SELECT 
    j.*,  -- All columns from jobs
    u.email as admin_email,
    u.raw_user_meta_data->>'full_name' as admin_name,
    u.raw_user_meta_data->>'avatar_url' as admin_avatar_url
FROM 
    jobs j
LEFT JOIN 
    auth.users u ON j.admin_id = u.id;

-- Grant access to the view
GRANT SELECT ON jobs_with_admin TO authenticated; 