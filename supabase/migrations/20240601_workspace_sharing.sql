-- Create workspace_members table for sharing workspaces
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (workspace_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members (user_id);

-- Enable RLS on workspace_members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Update workspaces RLS policies to allow access for members
DROP POLICY IF EXISTS workspaces_select_policy ON workspaces;
CREATE POLICY workspaces_select_policy
  ON workspaces
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = id AND user_id = auth.uid()
    )
  );

-- Update workspace_resources RLS policies to allow access for members
DROP POLICY IF EXISTS workspace_resources_select_policy ON workspace_resources;
CREATE POLICY workspace_resources_select_policy
  ON workspace_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.id = workspace_id AND (w.user_id = auth.uid() OR wm.user_id = auth.uid())
    )
  );

-- Policies for workspace_members
CREATE POLICY workspace_members_select_policy
  ON workspace_members
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    ) OR 
    user_id = auth.uid()
  );

CREATE POLICY workspace_members_insert_policy
  ON workspace_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = NEW.workspace_id AND user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = NEW.workspace_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY workspace_members_update_policy
  ON workspace_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_members.workspace_id AND user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

CREATE POLICY workspace_members_delete_policy
  ON workspace_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- Create update function for workspace_members
CREATE OR REPLACE FUNCTION update_workspace_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_members_updated_at
BEFORE UPDATE ON workspace_members
FOR EACH ROW
EXECUTE FUNCTION update_workspace_members_updated_at(); 