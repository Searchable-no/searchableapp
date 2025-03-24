-- Create function to execute arbitrary SQL with proper security controls
-- Only allow specific SQL operations for safety
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS jsonb 
LANGUAGE plpgsql
SECURITY DEFINER -- Run with definer (creator) privileges
AS $$
DECLARE
  result jsonb;
  operation text;
BEGIN
  -- Extract the operation type from the SQL (first word)
  SELECT lower(split_part(trim(sql), ' ', 1)) INTO operation;
  
  -- Only allow specific safe operations
  IF operation NOT IN ('select', 'insert', 'update', 'delete', 'alter', 'create') THEN
    RAISE EXCEPTION 'Operation % not allowed. Only SELECT, INSERT, UPDATE, DELETE, ALTER, and CREATE operations are permitted', operation;
  END IF;
  
  -- If this is an alter or create, only allow specific table operations for safety
  IF operation IN ('alter', 'create') THEN
    -- Only allow certain DDL operations
    IF NOT (
      -- Allow adding columns to profiles table
      (sql ILIKE '%alter table%profiles%add column%is_admin%')
      OR
      -- Allow creating policy on profiles
      (sql ILIKE '%create policy%on profiles%')
    ) THEN
      RAISE EXCEPTION 'This ALTER or CREATE operation is not allowed for security reasons';
    END IF;
  END IF;
  
  -- Execute the SQL and capture any result
  EXECUTE sql;
  
  -- Try to return data if it's a SELECT
  IF operation = 'select' THEN
    BEGIN
      EXECUTE 'SELECT json_agg(t) FROM (' || sql || ') t' INTO result;
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      -- If something goes wrong with the aggregation, just return success
      RETURN '{"status": "success", "message": "SQL executed successfully but could not return results"}'::jsonb;
    END;
  END IF;
  
  -- For non-SELECT operations, return success
  RETURN '{"status": "success", "message": "SQL executed successfully"}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$; 