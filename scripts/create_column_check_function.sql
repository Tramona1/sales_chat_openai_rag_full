-- Create function to check if a column exists in a table
CREATE OR REPLACE FUNCTION check_column_exists(table_name text, column_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = check_column_exists.table_name
    AND column_name = check_column_exists.column_name
  ) INTO column_exists;
  
  RETURN column_exists;
END;
$$;

-- Create function to create the check function (to be used if it doesn't exist)
CREATE OR REPLACE FUNCTION create_check_column_function()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE FUNCTION check_column_exists(table_name text, column_name text)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $inner$
    DECLARE
      column_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = check_column_exists.table_name
        AND column_name = check_column_exists.column_name
      ) INTO column_exists;
      
      RETURN column_exists;
    END;
    $inner$;';
  
  RETURN true;
END;
$$; 