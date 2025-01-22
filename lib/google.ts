import { prisma } from './prisma'

interface GoogleSearchResult {
  id: string
  name?: string
  title?: string
  subject?: string
  webViewLink?: string
  webLink?: string
  modifiedTime?: string
  lastModifiedTime?: string
}

export async function searchGoogle(userId: string, query: string) {
  try {
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    if (!connection) {
      throw new Error('Google connection not found')
    }

    // TODO: Check token expiration and refresh if needed

    // Search in Drive
    const driveResults = await searchDrive(connection.accessToken, query)
    
    // Search in Gmail
    const gmailResults = await searchGmail(connection.accessToken, query)

    return [...driveResults, ...gmailResults]
  } catch (error) {
    console.error('Google search error:', error)
    throw error
  }
}

async function searchDrive(accessToken: string, query: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=fullText contains '${query}'&fields=files(id,name,webViewLink,modifiedTime)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('Drive search failed')
  }

  const data = await response.json()
  return processSearchResults(data.files, 'drive')
}

async function searchGmail(accessToken: string, query: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('Gmail search failed')
  }

  const data = await response.json()
  const messages = await Promise.all(
    data.messages.slice(0, 10).map((msg: { id: string }) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=subject`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      ).then(res => res.json())
    )
  )

  return processSearchResults(messages, 'gmail')
}

function processSearchResults(results: GoogleSearchResult[], type: 'drive' | 'gmail') {
  return results.map(result => ({
    id: result.id,
    title: result.name || result.title || 
           (type === 'gmail' ? result.subject || 'No Subject' : 'Untitled'),
    url: result.webViewLink || result.webLink,
    lastModified: result.modifiedTime || result.lastModifiedTime || new Date().toISOString(),
    type: type === 'drive' ? 'document' : 'email',
    source: 'google',
  }))
} 