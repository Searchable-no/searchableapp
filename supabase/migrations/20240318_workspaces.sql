-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create workspace resources table
CREATE TABLE IF NOT EXISTS workspace_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('sharepoint', 'teams', 'planner')),
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  resource_url TEXT,
  bucket TEXT DEFAULT 'Ikke sortert',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (workspace_id, resource_type, resource_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON workspaces (user_id);
CREATE INDEX IF NOT EXISTS workspace_resources_workspace_id_idx ON workspace_resources (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_resources_bucket_idx ON workspace_resources (bucket);

-- Create RLS policies for workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select_policy
  ON workspaces
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY workspaces_insert_policy
  ON workspaces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workspaces_update_policy
  ON workspaces
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY workspaces_delete_policy
  ON workspaces
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for workspace resources
ALTER TABLE workspace_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_resources_select_policy
  ON workspace_resources
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = workspace_id
    AND w.user_id = auth.uid()
  ));

CREATE POLICY workspace_resources_insert_policy
  ON workspace_resources
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = workspace_id
    AND w.user_id = auth.uid()
  ));

CREATE POLICY workspace_resources_update_policy
  ON workspace_resources
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = workspace_id
    AND w.user_id = auth.uid()
  ));

CREATE POLICY workspace_resources_delete_policy
  ON workspace_resources
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = workspace_id
    AND w.user_id = auth.uid()
  )); 