import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/organizations/direct
// Hent alle organisasjoner brukeren har tilgang til, uten å bruke RLS
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Sjekk om brukeren er autentisert
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { error: "Autentisering kreves" },
      { status: 401 }
    );
  }
  
  try {
    // Bruk admin-klienten som omgår RLS
    // Hent først brukerens medlemskap
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id);
    
    if (membershipError) {
      throw membershipError;
    }
    
    if (!memberships || memberships.length === 0) {
      // Ingen organisasjoner - opprett standard organisasjon
      const { data: defaultOrg, error: createOrgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Min organisasjon',
          slug: `org-${user.id.substring(0, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createOrgError) {
        throw createOrgError;
      }
      
      // Legg til brukeren som eier
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: defaultOrg.id,
          user_id: user.id,
          role: 'owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (memberError) {
        throw memberError;
      }
      
      return NextResponse.json({ 
        organizations: [{
          ...defaultOrg,
          role: 'owner'
        }]
      });
    }
    
    // Hent organisasjonsdata for hvert medlemskap
    const organizationIds = memberships.map(m => m.organization_id);
    
    const { data: organizations, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', organizationIds);
      
    if (orgError) {
      throw orgError;
    }
    
    // Kombiner organisasjonsdata med roller
    const organizationsWithRoles = organizations.map(org => {
      const membership = memberships.find(m => m.organization_id === org.id);
      return {
        ...org,
        role: membership?.role || 'member'
      };
    });
    
    return NextResponse.json({ organizations: organizationsWithRoles });
    
  } catch (error: unknown) {
    console.error('Feil ved direkte henting av organisasjoner:', error);
    const errorMessage = error instanceof Error ? error.message : 'Feil ved henting av organisasjoner';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 