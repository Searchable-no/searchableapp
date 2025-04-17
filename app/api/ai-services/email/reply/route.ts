import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getGraphClient } from '@/lib/microsoft-graph';

interface ReplyRequest {
  emailId?: string;
  threadId?: string;
  isThread?: boolean;
  content: string;
  subject?: string;
}

export async function POST(request: NextRequest) {
  console.log("Email reply API called");
  
  try {
    // Get Supabase client and validate session
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("Authentication required", sessionError);
      return NextResponse.json(
        { error: 'Ikke autentisert' },
        { status: 401 }
      );
    }

    console.log(`User authenticated: ${session.user.email}`);
    
    // Parse request body
    const requestText = await request.text();
    console.log(`Raw request body: ${requestText}`);
    
    let body;
    try {
      body = JSON.parse(requestText);
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return NextResponse.json(
        { error: 'Ugyldig JSON i forespørselen' },
        { status: 400 }
      );
    }
    
    const { emailId, threadId, isThread, content, subject } = body as ReplyRequest;
    
    // Validate required fields - enten emailId eller threadId må være definert
    if ((!emailId && !threadId) || !content) {
      console.error("Missing required fields", { 
        hasEmailId: !!emailId, 
        hasThreadId: !!threadId, 
        hasContent: !!content 
      });
      return NextResponse.json(
        { error: 'Mangler e-post ID eller tråd ID eller innhold' },
        { status: 400 }
      );
    }
    
    // Logg hvilken ID vi bruker til å svare
    if (emailId) {
      console.log(`Preparing to reply to email with ID: ${emailId}, content length: ${content.length}`);
    } else if (threadId) {
      console.log(`Preparing to reply to thread with ID: ${threadId}, content length: ${content.length}`);
    }

    // Get user ID from the database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', session.user.email)
      .single();

    if (userError || !user) {
      console.error("User not found", userError);
      return NextResponse.json(
        { error: 'Bruker ikke funnet' },
        { status: 404 }
      );
    }

    console.log(`User found in DB: ${user.id}, ${user.email}`);

    // Get Microsoft Graph access token
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('access_token, provider')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (connectionError || !connection) {
      console.error("Microsoft connection not found", connectionError);
      return NextResponse.json(
        { error: 'Microsoft-tilkobling ikke funnet' },
        { status: 404 }
      );
    }

    console.log(`Microsoft Graph connection found for user, provider: ${connection.provider}`);
    
    // Get Microsoft Graph client
    try {
      const client = await getGraphClient(connection.access_token);
      console.log("Successfully initialized Microsoft Graph client");
      
      // Create the reply content with proper formatting
      const htmlContent = content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      
      console.log(`Prepared HTML content for reply, length: ${htmlContent.length}`);
      
      // Vi må bygge en Outlook URL direkte basert på ID-ene vi har
      console.log(`Getting original email to find its webLink`);

      try {
        let originalMessageWebLink = '';
        let subject = '';
        let recipient = '';
        
        if (emailId) {
          // Hent originalmeldingen for å få webLink
          const message = await client.api(`/me/messages/${emailId}`).select('id,subject,webLink,from').get();
          
          if (message && message.webLink) {
            originalMessageWebLink = message.webLink;
            subject = message.subject || '';
            recipient = message.from?.emailAddress?.name || message.from?.emailAddress?.address || '';
            console.log(`Found original email with webLink: ${originalMessageWebLink}`);
          } else {
            console.log("WebLink not found in original message, will construct URL manually");
          }
        } else if (threadId) {
          // Hent første melding i tråden
          const threadMessages = await client.api(`/me/messages`)
            .filter(`conversationId eq '${threadId}'`)
            .orderby('receivedDateTime desc')
            .select('id,subject,webLink,from,conversationId')
            .top(1)
            .get();
          
          if (threadMessages && threadMessages.value && threadMessages.value.length > 0) {
            const firstMessage = threadMessages.value[0];
            originalMessageWebLink = firstMessage.webLink || '';
            subject = firstMessage.subject || '';
            recipient = firstMessage.from?.emailAddress?.name || firstMessage.from?.emailAddress?.address || '';
            console.log(`Found thread message with webLink: ${originalMessageWebLink}`);
          } else {
            console.log("No messages found in thread or webLink not available");
          }
        }
        
        // Determine the best URL to open Outlook
        let outlookUrl = '';
        
        if (originalMessageWebLink) {
          // 1. Hvis vi har webLink, bruk den direkte - dette er mest pålitelig
          outlookUrl = originalMessageWebLink;
          console.log("Using original webLink to open message");
        } else if (emailId) {
          // 2. Prøv en annen variant av Outlook URL med ItemID-formatet
          const itemId = encodeURIComponent(emailId);
          outlookUrl = `https://outlook.office.com/mail/item/${itemId}`;
          console.log(`Using item-format URL: ${outlookUrl}`);
        } else if (threadId) {
          // 3. Bruk threadId for å åpne tråden
          const conversationId = encodeURIComponent(threadId);
          outlookUrl = `https://outlook.office.com/mail/conversation/${conversationId}`;
          console.log(`Using conversation-format URL: ${outlookUrl}`);
        } else {
          throw new Error('Mangler både emailId og threadId');
        }
        
        // Returner informasjon til frontend
        return NextResponse.json({
          success: true,
          action: {
            type: 'outlook_redirect',
            url: outlookUrl,
            message: 'Åpner Outlook Web',
            content: content,
            emailInfo: {
              subject: subject,
              recipient: recipient
            }
          }
        });
      } catch (lookupError) {
        console.error("Error looking up original message:", lookupError);
        
        // Fallback til å konstruere en generisk URL
        let fallbackUrl = '';
        if (emailId) {
          fallbackUrl = `https://outlook.office.com/mail/inbox`;
        } else if (threadId) {
          fallbackUrl = `https://outlook.office.com/mail/inbox`;
        } else {
          fallbackUrl = `https://outlook.office.com/mail`;
        }
        
        return NextResponse.json({
          success: true,
          action: {
            type: 'outlook_redirect',
            url: fallbackUrl,
            message: 'Kunne ikke åpne spesifikk e-post, åpner inbox',
            content: content,
            error: "Fant ikke e-post-lenken"
          }
        });
      }
    } catch (graphError: any) {
      console.error('Error initializing Microsoft Graph client:', graphError);
      return NextResponse.json(
        { error: 'Kunne ikke opprette tilkobling til Microsoft Graph' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in email reply endpoint:', error);
    return NextResponse.json(
      { error: 'Uventet feil ved sending av svar', details: error.message },
      { status: 500 }
    );
  }
}

// Hjelpefunksjon for å generere mailto-lenke
function generateMailtoLink(recipients: string[], subject: string, body: string): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body.replace(/\n/g, '%0A'));
  const recipientsStr = recipients.join(',');
  
  return `mailto:${recipientsStr}?subject=${encodedSubject}&body=${encodedBody}`;
} 