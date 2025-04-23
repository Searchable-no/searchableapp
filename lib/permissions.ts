import { createServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { OrganizationRole } from './database.types';

export enum Permission {
  ReadWorkspace = 'read:workspace',
  WriteWorkspace = 'write:workspace',
  ManageUsers = 'manage:users',
  ManageOrganization = 'manage:organization',
  AccessMicrosoftData = 'access:microsoft_data',
  AdminPanel = 'access:admin_panel',
}

// Definer hvilke tillatelser hver rolle har
const RolePermissions: Record<OrganizationRole, Permission[]> = {
  owner: [
    Permission.ReadWorkspace,
    Permission.WriteWorkspace,
    Permission.ManageUsers,
    Permission.ManageOrganization,
    Permission.AccessMicrosoftData,
  ],
  admin: [
    Permission.ReadWorkspace,
    Permission.WriteWorkspace,
    Permission.ManageUsers,
    Permission.AccessMicrosoftData,
  ],
  member: [
    Permission.ReadWorkspace,
    Permission.WriteWorkspace,
    Permission.AccessMicrosoftData,
  ],
  guest: [
    Permission.ReadWorkspace,
  ],
};

// Sjekker om en rolle har en spesifikk tillatelse
export function roleHasPermission(role: OrganizationRole, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) || false;
}

// Sjekker om brukeren har en spesifikk tillatelse i en organisasjon
export async function hasPermission(userId: string, organizationId: string, permission: Permission): Promise<boolean> {
  try {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
      
    if (error || !data) {
      console.error('Feil ved sjekking av rettigheter:', error);
      return false;
    }
    
    return roleHasPermission(data.role as OrganizationRole, permission);
  } catch (error) {
    console.error('Feil ved sjekking av rettigheter:', error);
    return false;
  }
}

// Hent brukerens organisasjonsrolle
export async function getUserRole(userId: string, organizationId: string): Promise<OrganizationRole | null> {
  try {
    const supabase = createServerClient(cookies());
    
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
      
    if (error || !data) {
      console.error('Feil ved henting av brukerrolle:', error);
      return null;
    }
    
    return data.role as OrganizationRole;
  } catch (error) {
    console.error('Feil ved henting av brukerrolle:', error);
    return null;
  }
}

// Sjekk om brukeren har minst en av flere tillatelser
export async function hasAnyPermission(
  userId: string, 
  organizationId: string, 
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId);
  if (!role) return false;
  
  return permissions.some(permission => roleHasPermission(role, permission));
}

// Sjekk om brukeren har alle de spesifiserte tillatelsene
export async function hasAllPermissions(
  userId: string, 
  organizationId: string, 
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId);
  if (!role) return false;
  
  return permissions.every(permission => roleHasPermission(role, permission));
} 