-- Create or replace the function to update push token
CREATE OR REPLACE FUNCTION update_user_push_token(
    p_user_id UUID,
    p_token TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET 
        expo_push_token = p_token,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING *;
END;
$$; 