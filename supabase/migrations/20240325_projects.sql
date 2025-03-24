-- Create enum for project column types
CREATE TYPE project_column_type AS ENUM ('text', 'number', 'date', 'select', 'multiselect', 'user', 'team', 'boolean');

-- Create enum for project member roles
CREATE TYPE project_member_role AS ENUM ('owner', 'editor', 'viewer');

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sharepoint_site_id TEXT,
  team_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create project columns table
CREATE TABLE IF NOT EXISTS project_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type project_column_type NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  options TEXT[] DEFAULT '{}',
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create project items table
CREATE TABLE IF NOT EXISTS project_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create project members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_member_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, user_id)
);

-- RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view projects they're members of" ON projects
  FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can insert projects" ON projects
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "Project owners can update projects" ON projects
  FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Project owners can delete projects" ON projects
  FOR DELETE
  USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Project columns policies
CREATE POLICY "Users can view columns of projects they're members of" ON project_columns
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can insert/update/delete columns" ON project_columns
  FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Project items policies
CREATE POLICY "Users can view items of projects they're members of" ON project_items
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners and editors can insert items" ON project_items
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  );

CREATE POLICY "Project owners and editors can update items" ON project_items
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  );

CREATE POLICY "Project owners can delete items" ON project_items
  FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Project members policies
CREATE POLICY "Members can view other members of their projects" ON project_members
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage members" ON project_members
  FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Create functions and triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_project_columns_timestamp
BEFORE UPDATE ON project_columns
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_project_items_timestamp
BEFORE UPDATE ON project_items
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_project_members_timestamp
BEFORE UPDATE ON project_members
FOR EACH ROW EXECUTE PROCEDURE update_timestamp(); 