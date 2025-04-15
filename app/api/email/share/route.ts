import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGraphClient } from '@/lib/microsoft-graph'

interface ShareViaEmailRequest {
  fileUrl: string;
  fileName: string;
  fileId: string;
  recipients: string[];
  shareAsLink: boolean;
  driveId?: string;
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
    const requestData: ShareViaEmailRequest = await request.json()
    const { fileUrl, fileName, fileId, recipients, shareAsLink, driveId } = requestData
    
    // Validate required fields
    if (!fileUrl || !fileName || !recipients || recipients.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Mangler påkrevde felt' }),
        { status: 400 }
      )
    }
    
    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return new NextResponse(
        JSON.stringify({ 
          error: `Ugyldig e-postadresse: ${invalidEmails.join(', ')}` 
        }),
        { status: 400 }
      )
    }

    // Hent bruker-ID fra databasen
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
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
    console.log(`Sharing file "${fileName}" with ${recipients.length} recipients via email`);
    
    try {
      if (shareAsLink) {
        // Del som lenke - send en e-post med lenke til filen
        console.log(`Sharing as link: ${fileUrl}`);
        
        const emailMessage = {
          message: {
            subject: `Fildeling: ${fileName}`,
            body: {
              contentType: 'HTML',
              content: `
                <p>Hei,</p>
                <p>${user.email} har delt en fil med deg:</p>
                <p><strong><a href="${fileUrl}">${fileName}</a></strong></p>
                <p>Klikk på lenken over for å åpne filen.</p>
                <p>Vennlig hilsen,<br>Searchable</p>
              `
            },
            toRecipients: recipients.map(email => ({
              emailAddress: {
                address: email
              }
            }))
          }
        }
        
        await client.api('/me/sendMail').post(emailMessage);
        console.log("Email with link sent successfully");
        
      } else {
        // Del som vedlegg - bruk contentUrl for å referere til filen
        console.log(`Sharing as attachment, fileId=${fileId}, driveId=${driveId}`);
        
        // Først, sikre at filens sharing-lenke er tilgjengelig
        if (!driveId || !fileId) {
          return new NextResponse(
            JSON.stringify({ error: 'Mangler driveId eller fileId for vedlegg' }),
            { status: 400 }
          )
        }
        
        // Opprett en delbar lenke for filen som Microsoft Graph kan bruke
        let sharingLink = fileUrl;
        try {
          console.log(`Creating sharing link for file ${fileId} in drive ${driveId}`);
          const permissionResponse = await client.api(`/drives/${driveId}/items/${fileId}/createLink`)
            .post({
              type: "view",
              scope: "anonymous"
            });
          
          if (permissionResponse?.link?.webUrl) {
            sharingLink = permissionResponse.link.webUrl;
            console.log(`Created sharing link: ${sharingLink}`);
          }
        } catch (error) {
          console.error('Error creating sharing link:', error)
          // Continue with original URL if sharing fails
        }
        
        // Opprett en e-post med vedlegg
        const emailWithAttachment = {
          message: {
            subject: `Fildeling: ${fileName}`,
            body: {
              contentType: 'HTML',
              content: `
                <p>Hei,</p>
                <p>${user.email} har delt en fil med deg.</p>
                <p>Filen er vedlagt denne e-posten. Hvis du har problemer med å åpne vedlegget, 
                kan du bruke denne lenken: <a href="${sharingLink}">${fileName}</a></p>
                <p>Vennlig hilsen,<br>Searchable</p>
              `
            },
            toRecipients: recipients.map(email => ({
              emailAddress: {
                address: email
              }
            })),
            attachments: [
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: fileName,
                contentUrl: sharingLink
              }
            ]
          }
        }
        
        await client.api('/me/sendMail').post(emailWithAttachment);
        console.log("Email with attachment sent successfully");
      }

      return NextResponse.json({ 
        success: true,
        message: `Filen har blitt delt med ${recipients.length} mottaker(e)`
      });
      
    } catch (error: unknown) {
      console.error('Error sending email:', error);
      
      const graphError = error as GraphError;
      
      if (graphError.statusCode === 403) {
        return new NextResponse(
          JSON.stringify({ error: 'Du har ikke tillatelse til å sende e-post fra denne kontoen.' }),
          { status: 403 }
        );
      } else if (graphError.statusCode === 400) {
        if (graphError.body?.includes('attachments')) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Kunne ikke legge ved filen. Prøv å dele som lenke i stedet.' 
            }),
            { status: 400 }
          );
        } else if (graphError.body?.includes('recipients')) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Problemer med e-postmottakerne. Sjekk at alle adressene er gyldige.' 
            }),
            { status: 400 }
          );
        }
      }
      
      return new NextResponse(
        JSON.stringify({ error: 'Feil ved sending av e-post. Prøv igjen senere.' }),
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sharing via email:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Feil ved deling via e-post' }),
      { status: 500 }
    )
  }
} 