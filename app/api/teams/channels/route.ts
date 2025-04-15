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
  const teamId = searchParams.get('teamId')

  if (!teamId) {
    return new NextResponse(
      JSON.stringify({ error: 'Team ID er påkrevd' }),
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

    // Hent kanaler for dette teamet
    const channelsResponse = await client.api(`/teams/${teamId}/channels`)
      .select('id,displayName')
      .get()

    const channels = channelsResponse.value || []

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Error fetching team channels:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved henting av kanaler' }),
      { status: 500 }
    )
  }
} 