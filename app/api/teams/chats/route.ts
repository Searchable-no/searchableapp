import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

// Grensesnitt for Chat-medlem
interface ChatMember {
  id: string;
  displayName?: string;
}

// Grensesnitt for Chat-respons fra Microsoft Graph
interface MicrosoftChat {
  id: string;
  topic?: string;
  chatType?: string;
  webUrl?: string;
  lastUpdatedDateTime?: string;
  members?: ChatMember[];
}

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
  const query = searchParams.get('query') || ''

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

    // Hent chatter med mer detaljert info
    let chatRequest = client.api('/me/chats')
      .select('id,topic,lastUpdatedDateTime,chatType,webUrl')
      .expand('members($select=id,displayName)')
      .top(20); // Limit to 20 chats

    // Bruk filter hvis vi har søkestreng
    if (query) {
      chatRequest = chatRequest.filter(`contains(topic, '${query}')`);
    }

    // Hent chatter med expanded info
    const chatsResponse = await chatRequest.get();
    
    // Log raw chat data for debugging
    console.log("Raw chat response:", JSON.stringify(chatsResponse.value?.slice(0, 2) || [], null, 2));
    
    // Valider og prosesser chats
    const chats = (chatsResponse.value || []).map((chat: MicrosoftChat) => {
      // Opprett en beskrivende tittel hvis topic ikke finnes
      let displayName = chat.topic || '';
      if (!displayName && chat.members && chat.members.length > 0) {
        // Bruk medlemmenes navn hvis topic er tom
        displayName = chat.members
          .filter((member: ChatMember) => member?.displayName)
          .map((member: ChatMember) => member.displayName)
          .join(', ');
            
        if (displayName.length > 30) {
          displayName = displayName.substring(0, 27) + '...';
        }
            
        if (!displayName) {
          displayName = 'Chat';
        }
      }
      
      // Make sure we're using the correct chat ID format
      // Chat IDs should be in the format "19:meetingorganizer@thread.tacv2"
      const chatId = chat.id;
      
      return {
        id: chatId,
        topic: displayName || 'Chat',
        chatType: chat.chatType || 'oneOnOne',
        webUrl: chat.webUrl,
        memberCount: (chat.members || []).length,
        lastUpdatedDateTime: chat.lastUpdatedDateTime
      };
    });

    console.log(`Hentet ${chats.length} chats`);
    
    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved henting av chatter' }),
      { status: 500 }
    )
  }
} 