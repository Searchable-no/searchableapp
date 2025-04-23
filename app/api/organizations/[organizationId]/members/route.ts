import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OrganizationRole } from "@/lib/database.types";

// GET /api/organizations/[organizationId]/members
// Hent alle medlemmer i en organisasjon
export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const { organizationId } = params;
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
    // Sjekk om brukeren har tilgang til organisasjonen
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();
      
    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til denne organisasjonen" },
        { status: 403 }
      );
    }
    
    // Hent alle medlemmer
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        created_at,
        user_id,
        user:profiles(
          email,
          display_name,
          avatar_url
        )
      `)
      .eq('organization_id', organizationId);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ members: data });
    
  } catch (error: unknown) {
    console.error('Feil ved henting av organisasjonsmedlemmer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Feil ved henting av organisasjonsmedlemmer';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[organizationId]/members
// Legg til et nytt medlem i organisasjonen
export async function POST(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const { organizationId } = params;
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
    // Sjekk om brukeren har administrator-tilgang til organisasjonen
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();
      
    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: "Du har ikke tillatelse til å legge til medlemmer i denne organisasjonen" },
        { status: 403 }
      );
    }
    
    // Hent data fra forespørselen
    const { email, role } = await request.json();
    
    if (!email || !role) {
      return NextResponse.json(
        { error: "E-post og rolle er påkrevd" },
        { status: 400 }
      );
    }
    
    // Valider rollen
    const validRoles: OrganizationRole[] = ['owner', 'admin', 'member', 'guest'];
    if (!validRoles.includes(role as OrganizationRole)) {
      return NextResponse.json(
        { error: "Ugyldig rolle. Gyldige roller er: " + validRoles.join(', ') },
        { status: 400 }
      );
    }
    
    // Finn brukeren basert på e-post
    const { data: userToAdd, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
      
    let userIdToAdd: string;
    
    if (userError || !userToAdd) {
      // Brukeren eksisterer ikke ennå, vi må opprette en invitasjon
      // For et ekte system vil du sende en invitasjon på e-post her
      
      // Opprett en ny bruker med supabaseAdmin
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
        user_metadata: {
          invited_to: organizationId,
          invited_by: user.id,
          invited_role: role,
        },
      });
      
      if (createError) {
        throw createError;
      }
      
      // Opprett profil for den nye brukeren
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: email.toLowerCase(),
          display_name: email.split('@')[0],
        });
        
      if (profileError) {
        throw profileError;
      }
      
      userIdToAdd = newUser.user.id;
    } else {
      userIdToAdd = userToAdd.id;
    }
    
    // Sjekk om brukeren allerede er medlem
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userIdToAdd)
      .single();
      
    if (existingMember) {
      return NextResponse.json(
        { error: "Brukeren er allerede medlem av denne organisasjonen" },
        { status: 400 }
      );
    }
    
    // Legg til brukeren som medlem
    const { data: newMember, error: addError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userIdToAdd,
        role: role as OrganizationRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (addError) {
      throw addError;
    }
    
    return NextResponse.json({ 
      message: "Medlem lagt til",
      member: newMember
    });
    
  } catch (error: unknown) {
    console.error('Feil ved tillegging av organisasjonsmedlem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Feil ved tillegging av organisasjonsmedlem';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 