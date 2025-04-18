import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return new NextResponse(
      JSON.stringify({ error: 'Ikke autentisert' }),
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  
  if (!query || query.trim().length < 2) {
    return new NextResponse(
      JSON.stringify({ error: 'Søketerm må være minst 2 tegn' }),
      { status: 400 }
    )
  }

  try {
    // Hent bruker-ID fra databasen
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !user) {
      return new NextResponse(
        JSON.stringify({ error: 'Bruker ikke funnet' }),
        { status: 404 }
      )
    }

    // Hent tilgangstoken for Microsoft Graph API
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single()

    if (connectionError || !connection) {
      return new NextResponse(
        JSON.stringify({ error: 'Microsoft-tilkobling ikke funnet' }),
        { status: 404 }
      )
    }

    const client = await getGraphClient(connection.access_token)
    
    try {
      // Forenklet bruker-søk for å redusere sjanse for tilgangsproblemer
      // Prøv først et mer begrenset søk som krever færre tillatelser
      const userResponse = await client.api('/users')
        .filter(`startswith(displayName,'${query}')`)
        .select('id,displayName,mail,userPrincipalName')
        .top(10)
        .get()
      
      // Format the response
      const users = (userResponse.value || []).map((user: any) => ({
        id: user.id,
        displayName: user.displayName || 'Ukjent bruker',
        email: user.mail || user.userPrincipalName,
        userPrincipalName: user.userPrincipalName,
      }))
      
      return NextResponse.json({ users })
    } catch (graphError: any) {
      console.error('Graph API error:', graphError)
      
      // Sjekk om dette er en tilgangsfeil
      if (graphError.statusCode === 403 || 
          (graphError.body && graphError.body.includes('Authorization_RequestDenied'))) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Manglende tillatelser. Applikasjonen mangler nødvendige tillatelser for å søke etter brukere.',
            details: 'User.Read.All eller User.ReadBasic.All tillatelse kreves i Microsoft Graph API.',
            authError: true
          }),
          { status: 403 }
        )
      }
      
      throw graphError // Kast feilen videre hvis det ikke er en tilgangsfeil
    }
  } catch (error) {
    console.error('Error searching for users:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Feil ved søk etter brukere. Kontakt administrator for hjelp med å konfigurere nødvendige tillatelser.',
      }),
      { status: 500 }
    )
  }
} 