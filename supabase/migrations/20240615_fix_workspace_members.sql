-- Fix the not-null constraint on the added_by column in workspace_members table
-- Option 1: Make the column nullable (preferred)
ALTER TABLE IF EXISTS workspace_members ALTER COLUMN added_by DROP NOT NULL;

-- Option 2: If you prefer to keep the constraint but provide a default, uncomment these lines
-- First, ensure the admin user exists
-- INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'admin@example.com')
-- ON CONFLICT (id) DO NOTHING;
-- 
-- ALTER TABLE workspace_members 
-- ALTER COLUMN added_by SET DEFAULT '00000000-0000-0000-0000-000000000000'; 