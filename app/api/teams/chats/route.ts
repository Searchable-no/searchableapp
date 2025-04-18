import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

// Grensesnitt for Chat-respons fra Microsoft Graph
interface MicrosoftChat {
  id: string;
  topic?: string;
  chatType?: string;
  webUrl?: string;
  lastUpdatedDateTime?: string;
}

// Grensesnitt for chat-medlem
interface ChatMember {
  id: string;
  displayName?: string;
}

// Enkel in-memory cache
interface CacheEntry {
  chats: any[];
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 60 sekunder cache
const chatCache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  // Legg til cache-control headers i response
  const responseInit = {
    headers: {
      'Cache-Control': 'max-age=60, s-maxage=60',
    }
  };

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return new NextResponse(
      JSON.stringify({ error: 'Ikke autentisert' }),
      { status: 401, ...responseInit }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query') || ''
  
  // Cache key basert på bruker og søkequery
  const cacheKey = `${session.user.email}:${query}`;
  
  // Sjekk om vi har en gyldig cachentry
  const cachedData = chatCache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    console.log(`Returnerer cached data for ${cacheKey}`);
    return NextResponse.json({ chats: cachedData.chats }, responseInit);
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
        { status: 404, ...responseInit }
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
        { status: 404, ...responseInit }
      )
    }

    const client = await getGraphClient(connection.access_token)

    // Hent chatter med grunnleggende info (uten expand members)
    let chatRequest = client.api('/me/chats')
      .select('id,topic,lastUpdatedDateTime,chatType,webUrl')
      .top(20); // Limit to 20 chats

    // Bruk filter hvis vi har søkestreng
    if (query) {
      chatRequest = chatRequest.filter(`contains(topic, '${query}')`);
    }

    // Hent chatter
    const chatsResponse = await chatRequest.get();
    
    // Log raw chat data for debugging
    console.log("Raw chat response:", JSON.stringify(chatsResponse.value?.slice(0, 2) || [], null, 2));
    
    // Prosesser chats og gjør individuelle kall for å hente medlemmer for chatter uten topic
    const chats = [];
    
    for (const chat of (chatsResponse.value || [])) {
      // Hvis chat har topic, bruk det direkte
      if (chat.topic) {
        chats.push({
          id: chat.id,
          topic: chat.topic,
          chatType: chat.chatType || 'oneOnOne',
          webUrl: chat.webUrl,
          lastUpdatedDateTime: chat.lastUpdatedDateTime
        });
        continue;
      }
      
      // For chatter uten topic, hent medlemmer individuelt
      try {
        // Lag et API-kall for denne spesifikke chatten for å hente medlemmer
        // Dette bruker et annet endepunkt som ikke har problemet med members($select) parameteren
        const chatMembers = await client.api(`/me/chats/${chat.id}/members`)
          .select('id,displayName')
          .get();
        
        // Lag et displaynavn basert på medlemmene
        let displayName = 'Chat';
        
        if (chatMembers && chatMembers.value && chatMembers.value.length > 0) {
          const memberNames = chatMembers.value
            .filter((member: ChatMember) => member.displayName)
            .map((member: ChatMember) => member.displayName);
          
          if (memberNames.length > 0) {
            // Fjern brukerens eget navn fra listen
            const myDisplayName = session.user.user_metadata?.name || session.user.email;
            const otherMemberNames = memberNames.filter((name: string) => name !== myDisplayName);
            
            displayName = otherMemberNames.length > 0 
              ? otherMemberNames.join(', ')
              : memberNames.join(', ');
              
            // Begrens lengden
            if (displayName.length > 30) {
              displayName = displayName.substring(0, 27) + '...';
            }
          }
        }
        
        chats.push({
          id: chat.id,
          topic: displayName,
          chatType: chat.chatType || 'oneOnOne',
          webUrl: chat.webUrl,
          lastUpdatedDateTime: chat.lastUpdatedDateTime
        });
      } catch (memberError) {
        // Hvis vi ikke kan hente medlemmer, bruk standard navn
        console.error(`Error fetching members for chat ${chat.id}:`, memberError);
        chats.push({
          id: chat.id,
          topic: chat.chatType === 'group' ? 'Gruppesamtale' : 'Chat',
          chatType: chat.chatType || 'oneOnOne',
          webUrl: chat.webUrl,
          lastUpdatedDateTime: chat.lastUpdatedDateTime
        });
      }
    }

    console.log(`Hentet ${chats.length} chats`);
    
    // Lagre i cache
    chatCache.set(cacheKey, {
      chats: chats,
      timestamp: Date.now()
    });
    
    return NextResponse.json({ chats }, responseInit);
  } catch (error) {
    console.error('Error fetching chats:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved henting av chatter' }),
      { status: 500, ...responseInit }
    )
  }
} 