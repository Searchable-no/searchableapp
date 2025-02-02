import { supabaseAdmin } from './supabase-server'
import { indexContent } from './embeddings'

const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0'

interface DriveItem {
  id: string;
  name?: string;
  webUrl?: string;
  lastModifiedDateTime: string;
  parentReference: {
    driveId: string;
  };
  content?: string;
}

interface SearchHit {
  resource: DriveItem;
}

interface MicrosoftError {
  code: string;
  message: string;
  innerError?: unknown;
}

interface Subscription {
  id?: string;
  changeType: string;
  notificationUrl: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
  error?: MicrosoftError;
}

export async function indexMicrosoftContent(userId: string) {
  console.log(`Starting Microsoft content indexing for user ${userId}`);
  
  try {
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('connections')
      .select()
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single();

    if (connectionError || !connection) {
      console.error(`User ${userId} not found or error:`, connectionError);
      return;
    }

    console.log(`Found user connection with access token`);
    
    if (!connection.access_token) {
      console.error('No access token found in connection');
      return;
    }

    console.log('Starting file indexing...');
    await indexFiles(connection.access_token, userId)
      .catch(error => {
        console.error('Error indexing files:', error.message);
        console.error(error.stack);
      });

    console.log('Starting email indexing...');
    await indexEmails(connection.access_token, userId)
      .catch(error => {
        console.error('Error indexing emails:', error.message);
        console.error(error.stack);
      });

    console.log('Completed Microsoft content indexing');
  } catch (error) {
    console.error('Error in indexMicrosoftContent:', error);
    throw error;
  }
}

async function getFileContent(accessToken: string, driveId: string, itemId: string): Promise<string> {
  try {
    // First try to get text content directly
    const response = await fetch(
      `${GRAPH_API_ENDPOINT}/drives/${driveId}/items/${itemId}/content`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'text/plain,application/pdf',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch file content: ${response.statusText}`);
      return '';
    }

    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('text/plain')) {
      return await response.text();
    } else if (contentType?.includes('application/pdf')) {
      // For PDFs, we need to use the preview API to get text content
      const previewResponse = await fetch(
        `${GRAPH_API_ENDPOINT}/drives/${driveId}/items/${itemId}/preview`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!previewResponse.ok) {
        console.error(`Failed to get preview: ${previewResponse.statusText}`);
        return '';
      }

      const previewData = await previewResponse.json();
      if (previewData.getUrl) {
        // Fetch the preview content
        const previewContentResponse = await fetch(previewData.getUrl);
        if (previewContentResponse.ok) {
          const previewContent = await previewContentResponse.text();
          return previewContent;
        }
      }
    }

    return '';
  } catch (error) {
    console.error('Error getting file content:', error);
    return '';
  }
}

async function indexFiles(accessToken: string, userId: string) {
  console.log('Making request to Microsoft Graph API for files...');
  
  if (!accessToken) {
    console.error('No access token provided for file indexing');
    return 0;
  }

  try {
    const response = await fetch(
      `${GRAPH_API_ENDPOINT}/search/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              entityTypes: ['driveItem'],
              query: {
                queryString: '*',
              },
              fields: [
                'id',
                'name',
                'webUrl',
                'lastModifiedDateTime',
                'parentReference',
                'file'
              ],
              from: 0,
              size: 25,
            },
          ],
        }),
      }
    );

    console.log(`Graph API response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Graph API error response:', errorText);
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Received response data:', JSON.stringify(data, null, 2));

    if (!data.value?.[0]?.hitsContainers?.[0]?.hits) {
      console.log('No files found in response');
      return 0;
    }

    const hits = data.value[0].hitsContainers[0].hits as SearchHit[];
    console.log(`Found ${hits.length} files to index`);

    for (const hit of hits) {
      try {
        const item = hit.resource;
        console.log(`Processing file: ${item.name} (${item.id})`);
        
        if (!item.webUrl) {
          console.log(`Skipping file ${item.id} - no URL available`);
          continue;
        }

        // Get the actual file content
        const fileContent = await getFileContent(
          accessToken,
          item.parentReference.driveId,
          item.id
        );

        await indexContent(
          userId,
          item.id,
          item.name || 'Untitled',
          fileContent || item.content || '',
          item.webUrl || null,
          'document',
          'microsoft',
          new Date(item.lastModifiedDateTime)
        );
        console.log(`Successfully indexed file: ${item.name}`);
      } catch (error) {
        console.error(`Error indexing file:`, error);
      }
    }

    return hits.length;
  } catch (error) {
    console.error('Error in indexFiles:', error);
    throw error;
  }
}

async function indexEmails(accessToken: string, userId: string) {
  console.log('Fetching emails from Microsoft Graph API...');

  if (!accessToken) {
    console.error('No access token provided for email indexing');
    return 0;
  }

  try {
    const response = await fetch(
      `${GRAPH_API_ENDPOINT}/me/messages?$select=id,subject,body,webLink,createdDateTime,lastModifiedDateTime&$top=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Email indexing failed:', errorText);
      throw new Error(`Email indexing failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Received email data from Microsoft Graph');
    const messages = data.value || [];
    console.log(`Found ${messages.length} emails to index`);

    let indexedCount = 0;
    for (const message of messages) {
      try {
        await indexContent(
          userId,
          message.id,
          message.subject || 'No Subject',
          message.body?.content || '',
          message.webLink || null,
          'email',
          'microsoft',
          new Date(message.lastModifiedDateTime || message.createdDateTime)
        );
        indexedCount++;
        console.log(`Indexed email ${indexedCount}/${messages.length}: ${message.subject || 'No Subject'}`);
      } catch (error) {
        console.error('Error indexing email:', message.id, error);
      }
    }

    return indexedCount;
  } catch (error) {
    console.error('Error in indexEmails:', error);
    throw error;
  }
}

export async function searchMicrosoft(userId: string) {
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('connections')
    .select()
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (connectionError) {
    console.error('Error getting Microsoft connection:', connectionError);
    return null;
  }

  return connection;
}

async function createSubscription(accessToken: string, subscription: Subscription): Promise<Subscription> {
  try {
    const response = await fetch(`${GRAPH_API_ENDPOINT}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const error = await response.json();
      return { ...subscription, error: error.error as MicrosoftError };
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating subscription:', error);
    return { 
      ...subscription, 
      error: {
        code: 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    };
  }
}

export async function createChangeNotificationSubscriptions(userId: string, accessToken: string) {
  console.log('Creating Microsoft Graph change notification subscriptions');
  
  // Get the base URL and ensure it's HTTPS
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not configured');
    return [];
  }

  // Skip subscription creation in development
  if (baseUrl.includes('localhost')) {
    console.log('Skipping subscription creation in development environment');
    return [];
  }

  const notificationUrl = baseUrl.replace('http://', 'https://') + '/api/webhooks/microsoft';
  console.log('Using notification URL:', notificationUrl);
  
  // Create subscriptions for different resource types
  const subscriptions = await Promise.all([
    createSubscription(accessToken, {
      changeType: 'updated',
      notificationUrl,
      resource: '/me/drive/root',
      expirationDateTime: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(), // 1 day
      clientState: userId,
    }),
    createSubscription(accessToken, {
      changeType: 'updated',
      notificationUrl,
      resource: '/me/messages',
      expirationDateTime: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(), // 1 day
      clientState: userId,
    }),
  ]);

  console.log('Created subscriptions:', subscriptions);

  // Update the connections table with subscription IDs
  const { error: updateError } = await supabaseAdmin
    .from('connections')
    .update({
      metadata: {
        subscriptions: subscriptions
          .filter(sub => !sub.error)
          .map(sub => ({
            id: sub.id,
            resource: sub.resource,
            expirationDateTime: sub.expirationDateTime,
          })),
      },
      updated_at: new Date().toISOString(),
    })
    .match({ user_id: userId, provider: 'microsoft' });

  if (updateError) {
    console.error('Error updating subscriptions:', updateError);
  }

  return subscriptions;
}

export async function renewSubscriptions(userId: string, accessToken: string) {
  // Get existing connection
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('connections')
    .select()
    .eq('user_id', userId)
    .single();

  if (connectionError || !connection) {
    console.error('Error getting connection:', connectionError);
    return await createChangeNotificationSubscriptions(userId, accessToken);
  }

  // ... rest of the code ...
} 