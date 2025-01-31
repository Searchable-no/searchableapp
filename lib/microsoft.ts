import { prisma } from './prisma'
import { indexContent } from './embeddings'

const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0'

// Constants for subscription management
const NOTIFICATION_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/microsoft`
const SUBSCRIPTION_EXPIRATION_DAYS = 2 // Microsoft limits to 3 days max

interface GraphSearchHit {
  hitId: string
  rank: number
  summary?: string
  resource: {
    '@odata.type': string
    id: string
    webUrl?: string
    name?: string
    subject?: string
    lastModifiedDateTime: string
    createdDateTime: string
    content?: string
    body?: {
      content: string
    }
  }
}

interface GraphSearchResult {
  '@odata.type': string
  id: string
  webUrl?: string
  name?: string
  subject?: string
  lastModifiedDateTime: string
  createdDateTime: string
  content?: string
  body?: {
    content: string
  }
}

export async function indexMicrosoftContent(userId: string) {
  console.log(`Starting Microsoft content indexing for user ${userId}`)
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connections: {
          where: { provider: 'microsoft' }
        }
      }
    })

    if (!user) {
      console.error(`User ${userId} not found`)
      return
    }

    console.log(`Found user ${user.email} with ${user.connections.length} Microsoft connection(s)`)
    
    const microsoftConnection = user.connections[0]
    if (!microsoftConnection) {
      console.error('No Microsoft connection found for user')
      return
    }

    console.log('Starting file indexing...')
    await indexFiles(microsoftConnection.accessToken, userId)
      .catch(error => {
        console.error('Error indexing files:', error.message)
        console.error(error.stack)
      })

    console.log('Starting email indexing...')
    await indexEmails(microsoftConnection.accessToken, userId)
      .catch(error => {
        console.error('Error indexing emails:', error.message)
        console.error(error.stack)
      })

    console.log('Completed Microsoft content indexing')
  } catch (error) {
    console.error('Error in indexMicrosoftContent:', error)
    throw error
  }
}

async function indexFiles(accessToken: string, userId: string) {
  console.log('Making request to Microsoft Graph API for files...')
  console.log(`Using access token: ${accessToken.substring(0, 20)}...`)

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
              from: 0,
              size: 25,
            },
          ],
        }),
      }
    )

    console.log(`Graph API response status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Graph API error response:', errorText)
      throw new Error(`Failed to fetch files: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Received response data:', JSON.stringify(data, null, 2))

    if (!data.value?.[0]?.hitsContainers?.[0]?.hits) {
      console.log('No files found in response')
      return 0
    }

    const hits = data.value[0].hitsContainers[0].hits
    console.log(`Found ${hits.length} files to index`)

    for (const hit of hits) {
      try {
        const item = hit.resource
        console.log(`Processing file: ${item.name} (${item.id})`)
        
        if (!item.content && !item.webUrl) {
          console.log(`Skipping file ${item.id} - no content or URL available`)
          continue
        }

        await indexContent(
          userId,
          item.id,
          item.name || 'Untitled',
          item.content || '',
          item.webUrl || null,
          'document',
          'microsoft',
          new Date(item.lastModifiedDateTime)
        )
        console.log(`Successfully indexed file: ${item.name}`)
      } catch (error) {
        console.error(`Error indexing file:`, error)
      }
    }

    return hits.length
  } catch (error) {
    console.error('Error in indexFiles:', error)
    throw error
  }
}

async function indexEmails(accessToken: string, userId: string) {
  console.log('Fetching emails from Microsoft Graph API...')
  const response = await fetch(
    `${GRAPH_API_ENDPOINT}/me/messages?$select=id,subject,body,webLink,createdDateTime,lastModifiedDateTime&$top=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Email indexing failed:', errorText)
    throw new Error(`Email indexing failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Received email data from Microsoft Graph')
  const messages = data.value || []
  console.log(`Found ${messages.length} emails to index`)

  let indexedCount = 0
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
      )
      indexedCount++
      console.log(`Indexed email ${indexedCount}/${messages.length}: ${message.subject || 'No Subject'}`)
    } catch (error) {
      console.error('Error indexing email:', message.id, error)
    }
  }

  return indexedCount
}

export async function searchMicrosoft(userId: string, query: string) {
  try {
    const results = await prisma.indexedContent.findMany({
      where: {
        userId,
        source: 'microsoft',
      },
      orderBy: {
        lastModified: 'desc',
      },
      take: 25,
    })

    return results.map((result: {
      id: string;
      title: string;
      content: string;
      url: string | null;
      lastModified: Date;
      type: 'email' | 'document';
      source: 'microsoft' | 'google';
    }) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      url: result.url,
      lastModified: result.lastModified.toISOString(),
      type: result.type,
      source: result.source,
    }))
  } catch (error) {
    console.error('Microsoft search error:', error)
    throw error
  }
}

async function searchFiles(accessToken: string, query: string) {
  const response = await fetch(
    `${GRAPH_API_ENDPOINT}/search/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          entityTypes: ['driveItem'],
          query: {
            queryString: query,
          },
          from: 0,
          size: 25,
          fields: [
            'id',
            'name',
            'webUrl',
            'lastModifiedDateTime',
            'createdDateTime',
            'content'
          ]
        }],
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.text()
    console.error('File search failed:', errorData)
    throw new Error('File search failed')
  }

  const data = await response.json()
  console.log('Microsoft search response:', JSON.stringify(data, null, 2))
  console.log('Search terms:', data.value?.[0]?.searchTerms)
  console.log('Hits containers:', data.value?.[0]?.hitsContainers)

  if (!data.value?.[0]?.hitsContainers?.[0]?.hits) {
    console.log('No hits found in response')
    return [] // Return empty array if no results
  }

  const hits = data.value[0].hitsContainers[0].hits
  console.log('Hits:', hits)

  return processSearchResults(hits)
}

async function searchOutlook(accessToken: string, query: string) {
  const response = await fetch(
    `${GRAPH_API_ENDPOINT}/me/messages?\$search="${query}"&\$select=id,subject,webLink,createdDateTime,lastModifiedDateTime,bodyPreview`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Outlook search failed:', errorData)
    throw new Error('Outlook search failed')
  }

  const data = await response.json()
  if (!data.value) {
    return [] // Return empty array if no results
  }

  return processSearchResults(data.value)
}

function processSearchResults(results: (GraphSearchHit | GraphSearchResult)[]) {
  if (!Array.isArray(results)) {
    console.error('Expected array of results, got:', results)
    return []
  }

  return results.map(result => {
    // For file search results, the actual data is in the resource property
    const item = 'resource' in result ? result.resource : result

    return {
      id: item.id,
      title: item.name || item.subject || 'Untitled',
      content: item.content || ('summary' in result ? result.summary : '') || '',
      url: item.webUrl,
      lastModified: item.lastModifiedDateTime,
      type: item['@odata.type']?.includes('message') ? 'email' : 'document',
      source: 'microsoft',
    }
  })
}

export async function createChangeNotificationSubscriptions(userId: string, accessToken: string) {
  console.log('Creating Microsoft Graph change notification subscriptions')
  
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + SUBSCRIPTION_EXPIRATION_DAYS)

  const subscriptions = [
    // OneDrive/SharePoint files subscription
    {
      changeType: 'created,updated',
      notificationUrl: NOTIFICATION_URL,
      resource: '/users/me/drive/root',
      expirationDateTime: expirationDate.toISOString(),
      clientState: userId, // Used to identify the user when receiving notifications
      includeResourceData: false
    },
    // Outlook messages subscription
    {
      changeType: 'created,updated',
      notificationUrl: NOTIFICATION_URL,
      resource: '/users/me/messages',
      expirationDateTime: expirationDate.toISOString(),
      clientState: userId,
      includeResourceData: false
    }
  ]

  try {
    const results = await Promise.all(
      subscriptions.map(subscription =>
        fetch(`${GRAPH_API_ENDPOINT}/subscriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(subscription)
        }).then(res => res.json())
      )
    )

    console.log('Created subscriptions:', results)
    
    // Store subscription IDs in database for renewal
    await prisma.connection.update({
      where: {
        userId_provider: {
          userId,
          provider: 'microsoft'
        }
      },
      data: {
        metadata: {
          subscriptions: results.map(sub => ({
            id: sub.id,
            expirationDateTime: sub.expirationDateTime
          }))
        }
      }
    })

    return results
  } catch (error) {
    console.error('Error creating subscriptions:', error)
    throw error
  }
}

export async function renewSubscriptions(userId: string, accessToken: string) {
  console.log('Renewing Microsoft Graph subscriptions')
  
  try {
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        provider: 'microsoft'
      }
    })

    if (!connection?.metadata?.subscriptions) {
      console.log('No subscriptions found to renew')
      return await createChangeNotificationSubscriptions(userId, accessToken)
    }

    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + SUBSCRIPTION_EXPIRATION_DAYS)

    const results = await Promise.all(
      connection.metadata.subscriptions.map(async (sub: any) => {
        try {
          const response = await fetch(
            `${GRAPH_API_ENDPOINT}/subscriptions/${sub.id}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                expirationDateTime: expirationDate.toISOString()
              })
            }
          )

          if (!response.ok) {
            throw new Error(`Failed to renew subscription ${sub.id}`)
          }

          return await response.json()
        } catch (error) {
          console.error(`Error renewing subscription ${sub.id}:`, error)
          // If renewal fails, create a new subscription
          return null
        }
      })
    )

    // Filter out failed renewals and update database
    const validSubscriptions = results.filter(Boolean)
    await prisma.connection.update({
      where: {
        userId_provider: {
          userId,
          provider: 'microsoft'
        }
      },
      data: {
        metadata: {
          subscriptions: validSubscriptions.map(sub => ({
            id: sub.id,
            expirationDateTime: sub.expirationDateTime
          }))
        }
      }
    })

    // If any renewals failed, create new subscriptions
    if (validSubscriptions.length < connection.metadata.subscriptions.length) {
      await createChangeNotificationSubscriptions(userId, accessToken)
    }

    return validSubscriptions
  } catch (error) {
    console.error('Error renewing subscriptions:', error)
    throw error
  }
} 