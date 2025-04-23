import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/organizations
// Hent alle organisasjoner brukeren har tilgang til
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
    // Hent organisasjonene brukeren er medlem av
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        organization:organizations(
          id,
          name,
          slug,
          ms_tenant_id,
          settings,
          created_at,
          updated_at
        ),
        role
      `)
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    // Formatter responsen
    const organizations = data.map(item => ({
      ...item.organization,
      role: item.role
    }));
    
    return NextResponse.json({ organizations });
    
  } catch (error: unknown) {
    console.error('Feil ved henting av organisasjoner:', error);
    const errorMessage = error instanceof Error ? error.message : 'Feil ved henting av organisasjoner';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/organizations
// Opprett en ny organisasjon
export async function POST(request: NextRequest) {
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
    // Hent data fra forespørselen
    const { name, slug, ms_tenant_id } = await request.json();
    
    if (!name || !slug) {
      return NextResponse.json(
        { error: "Navn og slug er påkrevd" },
        { status: 400 }
      );
    }
    
    // Valider slug-format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug kan kun inneholde små bokstaver, tall og bindestrek" },
        { status: 400 }
      );
    }
    
    // Sjekk at slug er unik
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();
      
    if (existingOrg) {
      return NextResponse.json(
        { error: "En organisasjon med denne slug-en eksisterer allerede" },
        { status: 400 }
      );
    }
    
    // Opprett organisasjonen
    const { data: organization, error: createError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        ms_tenant_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      throw createError;
    }
    
    // Legg til brukeren som eier av organisasjonen
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (memberError) {
      throw memberError;
    }
    
    return NextResponse.json({ 
      message: "Organisasjon opprettet",
      organization 
    });
    
  } catch (error: unknown) {
    console.error('Feil ved opprettelse av organisasjon:', error);
    const errorMessage = error instanceof Error ? error.message : 'Feil ved opprettelse av organisasjon';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 