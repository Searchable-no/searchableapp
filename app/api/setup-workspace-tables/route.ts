import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  try {
    // Check if user is logged in and is an admin
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Try to query the workspaces table to see if it exists
    const { error: checkError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(1);

    // If we got an error and it's not the "relation does not exist" error, return that error
    if (checkError && checkError.code !== 'PGRST301') {
      throw checkError;
    }

    // If the table doesn't exist, we need to manually create it through Supabase dashboard
    if (checkError && checkError.code === 'PGRST301') {
      return NextResponse.json({
        success: false,
        needsManualSetup: true,
        message: `The workspaces tables don't exist. Please run the following SQL in the Supabase dashboard SQL editor:`,
        sql: `
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
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  resource_url TEXT,
  bucket TEXT DEFAULT 'Ikke sortert',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON workspaces (user_id);
CREATE INDEX IF NOT EXISTS workspace_resources_workspace_id_idx ON workspace_resources (workspace_id);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY workspaces_select_policy ON workspaces
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY workspaces_insert_policy ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY workspaces_update_policy ON workspaces
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY workspaces_delete_policy ON workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for workspace_resources
CREATE POLICY workspace_resources_select_policy ON workspace_resources
  FOR SELECT USING (EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND user_id = auth.uid()));
CREATE POLICY workspace_resources_insert_policy ON workspace_resources
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND user_id = auth.uid()));
CREATE POLICY workspace_resources_update_policy ON workspace_resources
  FOR UPDATE USING (EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND user_id = auth.uid()));
CREATE POLICY workspace_resources_delete_policy ON workspace_resources
  FOR DELETE USING (EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND user_id = auth.uid()));`
      });
    }

    // If we get here, the tables exist
    return NextResponse.json({
      success: true,
      message: 'Workspace tables already exist. Your workspaces feature is ready to use.'
    });
  } catch (error: unknown) {
    console.error('Error checking workspace tables:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check workspace tables';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 