import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getAllTeams, getGraphClient } from '@/lib/microsoft-graph'

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

  if (!query) {
    return new NextResponse(
      JSON.stringify({ error: 'Søkeord er påkrevd' }),
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

    // Søk etter Teams
    const teams = await getAllTeams(user.id)

    // Legg til informasjon om brukerens tilgang til Teams
    console.log(`Bruker ${user.id} har tilgang til ${teams.length} teams`)
    
    // Søk etter chatter
    const chatsResponse = await client.api('/me/chats')
      .filter(`contains(topic, '${query}')`)
      .select('id,topic,lastUpdatedDateTime')
      .get()

    // Definer interface for chat-objektet
    interface ChatResponse {
      id: string;
      topic?: string;
    }

    const chats = (chatsResponse.value || []).map((chat: ChatResponse) => ({
      id: chat.id,
      displayName: chat.topic || 'Chat',
      type: 'chat' as const
    }))

    // Filtrer team basert på søkeordet
    const filteredTeams = teams
      .filter(team => team.displayName.toLowerCase().includes(query.toLowerCase()))
      .map(team => ({
        id: team.id,
        displayName: team.displayName,
        type: 'team' as const
      }))

    // Hent kanaler for hvert team som matchet søket
    const channels = []
    
    // Hent brukerens team-medlemskap
    const joinedTeamsResponse = await client.api('/me/joinedTeams')
      .select('id,displayName')
      .get()
      
    const joinedTeamIds = new Set((joinedTeamsResponse.value || []).map((team: { id: string }) => team.id))
    console.log(`Bruker er medlem av ${joinedTeamIds.size} teams`)
    
    // Definer channel interface
    interface ChannelResponse {
      id: string;
      displayName: string;
    }
    
    // Bare hent kanaler for team brukeren faktisk er medlem av
    for (const team of filteredTeams) {
      // Sjekk om brukeren er medlem av dette teamet
      if (!joinedTeamIds.has(team.id)) {
        console.log(`Hopper over team ${team.id} (${team.displayName}) - bruker er ikke medlem`)
        continue
      }
      
      try {
        console.log(`Henter kanaler for team: ${team.displayName} (${team.id})`)
        const channelsResponse = await client.api(`/teams/${team.id}/channels`)
          .select('id,displayName')
          .get()
        
        const teamChannels = (channelsResponse.value || [])
          .filter((channel: ChannelResponse) => 
            channel.displayName.toLowerCase().includes(query.toLowerCase())
          )
          .map((channel: ChannelResponse) => ({
            id: `${team.id}:${channel.id}`,
            displayName: `${team.displayName} > ${channel.displayName}`,
            teamId: team.id,
            channelId: channel.id,
            type: 'channel' as const
          }))
        
        console.log(`Fant ${teamChannels.length} kanaler i team ${team.displayName}`)
        channels.push(...teamChannels)
      } catch (error) {
        console.error(`Error fetching channels for team ${team.id}:`, error)
      }
    }

    // Kombiner resultatene
    const results = [...filteredTeams, ...chats, ...channels]
    
    // Logg resultatene for debugging
    console.log(`Totalt ${results.length} resultater: ${filteredTeams.length} teams, ${chats.length} chatter, ${channels.length} kanaler`)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error searching Teams entities:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved søk i Teams' }),
      { status: 500 }
    )
  }
} 