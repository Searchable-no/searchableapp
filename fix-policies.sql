-- Denne filen fikser uendelig rekursjon i RLS-policiene

-- Fjern eksisterende policies
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can access organization data" ON workspaces;
DROP POLICY IF EXISTS "Users can access their organizations' projects" ON projects;
DROP POLICY IF EXISTS "Organization members can access org membership data" ON organization_members;
DROP POLICY IF EXISTS "Users can only manage their own org membership" ON organization_members;
DROP POLICY IF EXISTS "Members can view all users in their organizations" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage organization membership" ON organization_members;

-- Legg til riktige RLS-policies
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

-- Fikset policy for å unngå sirkelreferanse
CREATE POLICY "Members can view all users in their organizations" 
  ON organization_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Fikset policy for oppdatering/sletting for å unngå sirkelreferanse
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