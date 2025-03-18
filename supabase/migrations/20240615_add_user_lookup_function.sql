-- Function to find a user by email
-- This function can be called by authenticated users but only returns basic user information
CREATE OR REPLACE FUNCTION find_user_by_email(email_param TEXT)
RETURNS json AS $$
DECLARE
  user_record RECORD;
  result_json json;
BEGIN
  -- Look up the user ID from auth.users
  -- This requires security definer to bypass RLS
  SELECT id, email 
  INTO user_record
  FROM auth.users
  WHERE email = email_param
  LIMIT 1;
  
  -- If we found a user, return basic information
  IF FOUND THEN
    -- Construct a result with minimal information
    SELECT json_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'display_name', split_part(user_record.email, '@', 1), -- Simple display name from email
      'avatar_url', NULL -- No avatar
    ) INTO result_json;
    
    RETURN result_json;
  ELSE
    -- No user found
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission for authenticated users to execute the function
GRANT EXECUTE ON FUNCTION find_user_by_email(TEXT) TO authenticated;

-- Alternative function that returns a row directly
CREATE OR REPLACE FUNCTION query_user_by_email_workaround(email_to_find TEXT)
RETURNS json AS $$
DECLARE
  found_user RECORD;
BEGIN
  -- Direct query to auth.users
  SELECT id, email
  INTO found_user
  FROM auth.users
  WHERE email = email_to_find
  LIMIT 1;
  
  IF FOUND THEN
    RETURN json_build_object(
      'id', found_user.id,
      'email', found_user.email
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION query_user_by_email_workaround(TEXT) TO authenticated; 