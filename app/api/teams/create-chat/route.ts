import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

interface CreateChatRequest {
  members: string[]; // Array of user IDs or emails
  topic?: string; // Optional chat topic
}

interface ChatMember {
  '@odata.type': '#microsoft.graph.aadUserConversationMember';
  roles: string[];
  'user@odata.bind': string;
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return new NextResponse(
      JSON.stringify({ error: 'Ikke autentisert' }),
      { status: 401 }
    )
  }

  try {
    const requestData: CreateChatRequest = await request.json()
    const { members, topic } = requestData
    
    if (!members || !Array.isArray(members) || members.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Du må angi minst én chatdeltaker' }),
        { status: 400 }
      )
    }

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
    
    // Format chat members for Microsoft Graph API
    const formattedMembers: ChatMember[] = [
      // Always include the current user as owner
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${session.user.email}`
      }
    ]
    
    // Add other members
    for (const member of members) {
      // Skip if the member is the current user (already added as owner)
      if (member === session.user.email) continue
      
      formattedMembers.push({
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: [],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${member}`
      })
    }
    
    // Create the chat
    const chatPayload: any = {
      chatType: 'group',
      members: formattedMembers
    }
    
    // Add topic if provided
    if (topic && topic.trim()) {
      chatPayload.topic = topic.trim()
    }
    
    console.log('Creating new chat with payload:', JSON.stringify(chatPayload, null, 2))
    
    try {
      const response = await client.api('/chats').post(chatPayload)
      
      console.log('Chat created successfully:', response.id)
      
      return NextResponse.json({ 
        success: true, 
        chat: {
          id: response.id,
          topic: response.topic || 'New Chat',
          chatType: response.chatType,
          webUrl: response.webUrl || `https://teams.microsoft.com/l/chat/${response.id}`,
          memberCount: formattedMembers.length
        }
      })
    } catch (chatError: any) {
      console.error('Error creating chat:', chatError)
      
      // Sjekk om dette er en tilgangsfeil
      if (chatError.statusCode === 403 || 
          (chatError.body && chatError.body.includes('Authorization_RequestDenied'))) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Manglende tillatelser for å opprette chat',
            details: 'Applikasjonen mangler nødvendige tillatelser. "Chat.Create" eller "Chat.ReadWrite" tillatelse er påkrevd i Microsoft Graph API.',
            authError: true,
            rawError: chatError.body || chatError.message
          }),
          { status: 403 }
        )
      }
      
      // Provide better error messages based on common failure modes
      if (chatError.statusCode === 403) {
        return new NextResponse(
          JSON.stringify({ error: 'Du har ikke tillatelse til å opprette chatter med disse brukerne' }),
          { status: 403 }
        )
      } else if (chatError.statusCode === 404) {
        return new NextResponse(
          JSON.stringify({ error: 'En eller flere av brukerne du prøvde å legge til eksisterer ikke' }),
          { status: 404 }
        )
      } else if (chatError.body && chatError.body.includes('InvalidRecipient')) {
        return new NextResponse(
          JSON.stringify({ error: 'En eller flere av e-postadressene er ikke gyldige' }),
          { status: 400 }
        )
      }
      
      // Default error message
      return new NextResponse(
        JSON.stringify({ 
          error: 'Kunne ikke opprette chat. Sjekk at alle brukerne er gyldige.',
          details: chatError.body || chatError.message
        }),
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in create-chat API:', error)
    return new NextResponse(
      JSON.stringify({ error: 'En feil oppstod ved oppretting av chat' }),
      { status: 500 }
    )
  }
} 