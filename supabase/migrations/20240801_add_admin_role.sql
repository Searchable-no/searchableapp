-- Add is_admin column to profiles table if it doesn't exist
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create a security policy to allow only admins to update is_admin
CREATE POLICY update_admin_status_policy
  ON profiles
  FOR UPDATE TO authenticated
  USING (
    -- Allow update on other columns
    (get_current_column_names() <> ARRAY['is_admin']::text[])
    OR
    -- Or allow is_admin update only for admins
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to get current column names (used in the policy)
CREATE OR REPLACE FUNCTION get_current_column_names()
RETURNS text[] AS $$
DECLARE
  result text[];
BEGIN
  SELECT array_agg(column_name::text) INTO result
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = TG_TABLE_NAME
    AND column_name != ALL(TG_ARGV);
  RETURN result;
END;
$$ LANGUAGE plpgsql; 