import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/auth/microsoft/tenant?tenant_id=xxx&organization_id=yyy
// Starter en Microsoft-autentiseringsflyt for en spesifikk tenant
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get('tenant_id');
  const organizationId = searchParams.get('organization_id');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // Verifiser at nødvendige parametere er tilgjengelig
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id parameter er påkrevd' }, { status: 400 });
  }
  
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id parameter er påkrevd' }, { status: 400 });
  }
  
  // Sjekk at brukeren er logget inn
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Du må være innlogget for å koble til en Microsoft-tenant' }, { status: 401 });
  }
  
  // Sjekk at brukeren har tilgang til organisasjonen
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single();
    
  if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Du har ikke tillatelse til å koble denne organisasjonen til Microsoft' },
      { status: 403 }
    );
  }
  
  // Lagre tenant-informasjon i en midlertidig session state
  const { error: stateError } = await supabase
    .from('auth_flow_state')
    .insert({
      user_id: user.id,
      provider: 'microsoft',
      state: `${tenantId}:${organizationId}`,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 time
    });
    
  if (stateError) {
    console.error('Feil ved lagring av auth state:', stateError);
    return NextResponse.json({ error: 'Feil ved initialisering av autentiseringsflyt' }, { status: 500 });
  }
  
  // Omdirigerer til Microsoft-pålogging med spesifikk tenant
  const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  
  const scope = encodeURIComponent(
    'openid email profile offline_access User.Read Mail.Read Files.Read.All Sites.Read.All'
  );
  
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${scope}` +
    `&state=${tenantId}:${organizationId}`;
  
  return NextResponse.redirect(authUrl);
} 