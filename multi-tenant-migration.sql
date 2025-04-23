-- Organisasjonstabell
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  ms_tenant_id TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Kobling mellom brukere og organisasjoner
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Oppdatere eksisterende tabeller
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Aktivere Row-Level Security på alle tabeller
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Fjern eksisterende policies hvis de finnes
DO $$
BEGIN
    -- Forsøker å slette policies - feil ignoreres hvis de ikke eksisterer
    BEGIN
        DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Users can access organization data" ON workspaces;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Users can access their organizations' projects" ON projects;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Organization members can access org membership data" ON organization_members;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Users can only manage their own org membership" ON organization_members;
    EXCEPTION WHEN OTHERS THEN END;
END $$;

-- RLS-policy for organisasjonstilhørighet
CREATE POLICY "Users can view their own organizations" 
  ON organizations FOR SELECT 
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access organization data" 
  ON workspaces FOR ALL 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access their organizations' projects" 
  ON projects FOR ALL 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Endre policy for å unngå sirkelreferanse
CREATE POLICY "Members can view all users in their organizations" 
  ON organization_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Endre policy for oppdatering/sletting for å unngå sirkelreferanse
CREATE POLICY "Admins can manage organization membership" 
  ON organization_members FOR ALL 
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  ); 