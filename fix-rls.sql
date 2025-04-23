-- Denne filen fullstendig fjerner og oppretter på nytt alle RLS-policies
-- for å løse problemer med uendelig rekursjon

-- Deaktiver RLS midlertidig for å gjøre det enklere å jobbe med dataene
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Fjern ALLE eksisterende policies (for å være helt sikker)
DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Fjern alle policies på organization_members
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'organization_members'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organization_members', pol.policyname);
  END LOOP;

  -- Fjern alle policies på organizations
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'organizations'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
  END LOOP;

  -- Fjern alle policies på workspaces
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'workspaces'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workspaces', pol.policyname);
  END LOOP;

  -- Fjern alle policies på projects
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'projects'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
  END LOOP;
END
$$;

-- Gjenopprett riktige policies med aliaser for å unngå rekursjon

-- 1. Organizations policy - brukere kan se organisasjoner de er medlem av
CREATE POLICY "Users can view their own organizations" 
  ON organizations FOR SELECT 
  USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- 2. Organization members policy - brukere kan se medlemskap i organisasjoner de er medlem av
-- Her bruker vi en explisitt alias for organization_members (m) for å unngå rekursjon
CREATE POLICY "Members can view users in their organizations" 
  ON organization_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organization_members.organization_id
      AND m.user_id = auth.uid()
    )
  );

-- 3. Organization admins kan administrere medlemskap
CREATE POLICY "Admins can manage organization membership" 
  ON organization_members FOR ALL 
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organization_members.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
  );

-- 4. Workspaces policy
CREATE POLICY "Users can access organization workspaces" 
  ON workspaces FOR ALL 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- 5. Projects policy
CREATE POLICY "Users can access organization projects" 
  ON projects FOR ALL 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Aktiver RLS igjen etter at alle policies er på plass
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Sjekk-status
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_members', 'workspaces', 'projects'); 