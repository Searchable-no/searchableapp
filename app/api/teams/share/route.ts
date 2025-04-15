import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

interface ShareToTeamsRequest {
  fileUrl: string;
  fileName: string;
  teamsEntityId: string;
}

// Define GraphError interface for better type checking
interface GraphError {
  statusCode?: number;
  code?: string;
  message?: string;
  requestId?: string;
  date?: Date;
  body?: string;
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
    const requestData: ShareToTeamsRequest = await request.json()
    const { fileUrl, fileName, teamsEntityId } = requestData
    
    if (!fileUrl || !fileName || !teamsEntityId) {
      return new NextResponse(
        JSON.stringify({ error: 'Mangler påkrevde felt' }),
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
    
    // Log sharing attempt
    console.log(`Attempting to share file "${fileName}" to ${teamsEntityId}`);
    
    // Sjekk hvilken type entitet som er valgt (chat, team eller kanal)
    if (teamsEntityId.includes(':')) {
      // Dette er en kanal (team:channel format)
      // Split only at the first colon since channel IDs can contain colons themselves
      const firstColonIndex = teamsEntityId.indexOf(':');
      const teamId = teamsEntityId.substring(0, firstColonIndex);
      const channelId = teamsEntityId.substring(firstColonIndex + 1);
      
      // Validate that both IDs look valid (non-empty strings)
      if (!teamId || !channelId) {
        console.error(`Invalid channel format - missing teamId or channelId: ${teamsEntityId}`);
        return new NextResponse(
          JSON.stringify({ error: 'Ugyldig kanal-ID format. Formatet skal være "teamId:channelId".' }),
          { status: 400 }
        );
      }
      
      console.log(`Sharing to team channel: team=${teamId}, channel=${channelId}`);
      
      try {
        // Send melding til kanal
        const response = await client.api(`/teams/${teamId}/channels/${channelId}/messages`)
          .post({
            body: {
              content: `<div><p>Her er filen du ba om: <a href="${fileUrl}">${fileName}</a></p></div>`,
              contentType: 'html'
            }
          })
        
        console.log("Successfully shared to team channel, response:", response);
        
        return NextResponse.json({ 
          success: true,
          message: 'Filen har blitt delt til kanal'
        });
      } catch (error: unknown) {
        console.error("Error sharing to team channel:", error);
        
        // Improved error handling with more specific messages
        const graphError = error as GraphError;
        
        if (graphError.statusCode === 404 || graphError.code === 'NotFound') {
          // Check if the error is about the team or the channel
          if (graphError.body?.includes("Invalid ThreadId")) {
            return new NextResponse(
              JSON.stringify({ 
                error: 'Kanalen ble ikke funnet. Kontroller at kanal-ID er korrekt og at du har tilgang til den.'
              }),
              { status: 404 }
            );
          } else {
            return new NextResponse(
              JSON.stringify({ 
                error: 'Teamet eller kanalen ble ikke funnet. Kontroller at team-ID og kanal-ID er korrekte og at du har tilgang til dem.'
              }),
              { status: 404 }
            );
          }
        } else if (graphError.statusCode === 403) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Du har ikke tillatelse til å sende meldinger i denne kanalen.'
            }),
            { status: 403 }
          );
        }
        
        return new NextResponse(
          JSON.stringify({ error: 'Feil ved deling til Teams-kanal. Sjekk at du har tilgang til å poste i denne kanalen.' }),
          { status: 500 }
        );
      }
    } else if (teamsEntityId.length < 36) {
      // Eksempel-ID for de forhåndsdefinerte kategoriene
      console.log("Demo sharing with predefined ID:", teamsEntityId);
      
      return new NextResponse(
        JSON.stringify({ success: true, message: 'Simulert deling (demo)' }),
        { status: 200 }
      )
    } else {
      // Dette kunne være en chat eller en ugyldig ID
      console.log(`Sharing to entity with ID: ${teamsEntityId}`);
      
      // Check if this could be a team ID that's missing a channel reference
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamsEntityId)) {
        console.error("This appears to be a team ID without a channel ID. For channels, use format 'teamId:channelId'");
        return new NextResponse(
          JSON.stringify({ 
            error: 'Dette ser ut til å være en team-ID uten kanal-ID. For å dele til en kanal, bruk formatet "teamId:channelId".'
          }),
          { status: 400 }
        );
      }
      
      // Check if the chat ID has the expected Microsoft Graph format (should start with digits and colon)
      if (!/^\d+:/.test(teamsEntityId)) {
        console.error("Invalid chat ID format:", teamsEntityId);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Ugyldig ID-format. For chats bør ID starte med tall og kolon (f.eks. "19:"). For kanaler bør formatet være "teamId:channelId".'
          }),
          { status: 400 }
        );
      }
      
      try {
        // Validate the chat ID first by checking if it exists
        try {
          // Try to get chat details to verify it exists and is accessible
          console.log(`Verifying chat exists: ${teamsEntityId}`);
          await client.api(`/me/chats/${teamsEntityId}`).get();
        } catch (verifyError: unknown) {
          console.error("Error verifying chat exists:", verifyError);
          const graphError = verifyError as GraphError;
          
          if (graphError.code === 'BadRequest' && graphError.body?.includes('ParsingFailed')) {
            return new NextResponse(
              JSON.stringify({ 
                error: 'Ugyldig chat ID-format. Vennligst prøv å dele med en annen chat.'
              }),
              { status: 400 }
            );
          } else if (graphError.statusCode === 404) {
            return new NextResponse(
              JSON.stringify({ 
                error: 'Chatten ble ikke funnet. Den kan være utgått eller du mangler tilgang til den.'
              }),
              { status: 404 }
            );
          }
          // If other error, continue with the send attempt
        }
        
        // Send melding til chat - bruk chatMessages endpoint med riktig format
        const response = await client.api(`/me/chats/${teamsEntityId}/messages`)
          .post({
            body: {
              content: `<div><p>Her er filen du ba om: <a href="${fileUrl}">${fileName}</a></p></div>`,
              contentType: 'html'
            }
          });
        
        console.log("Successfully shared to chat, response:", response);
        
        return NextResponse.json({ 
          success: true,
          message: 'Filen har blitt delt til chat'
        });
      } catch (error: unknown) {
        console.error("Error sharing to chat:", error);
        
        // Forbedret feilmeldinger basert på feilkode
        const graphError = error as GraphError;
        
        // Check for specific error messages that indicate invalid format
        if (graphError.body && (graphError.body.includes("Invalid ThreadId") || 
            graphError.body.includes("ParsingFailed") || 
            graphError.body.includes("Invalid MRI"))) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Ugyldig chat-ID format. Dette kan skyldes at chat-IDen ikke lenger er gyldig eller at formatet er endret.'
            }),
            { status: 400 }
          );
        } else if (graphError.statusCode === 404 || graphError.code === 'NotFound') {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Chatten ble ikke funnet. Den kan være utgått eller du mangler tilgang til den.'
            }),
            { status: 404 }
          );
        } else if (graphError.statusCode === 403) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Du har ikke tillatelse til å sende meldinger i denne chatten.'
            }),
            { status: 403 }
          );
        }
        
        return new NextResponse(
          JSON.stringify({ 
            error: 'Feil ved deling til Teams-chat. Sjekk at du har tilgang til å poste i denne chatten.' 
          }),
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Error sharing to Teams:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved deling til Teams' }),
      { status: 500 }
    )
  }
} 