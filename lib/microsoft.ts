import { prisma } from './prisma'

const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0'

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
}

export async function searchMicrosoft(userId: string, query: string) {
  try {
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        provider: 'microsoft',
      },
    })

    if (!connection) {
      throw new Error('Microsoft connection not found')
    }

    // TODO: Check token expiration and refresh if needed

    // Search in SharePoint and OneDrive
    const fileResults = await searchFiles(connection.accessToken, query)
    
    // Search in Outlook
    const outlookResults = await searchOutlook(connection.accessToken, query)

    return [...fileResults, ...outlookResults]
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