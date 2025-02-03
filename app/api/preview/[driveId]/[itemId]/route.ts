import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

async function getAccessToken(): Promise<string | null> {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('ms_token')?.value
  return accessToken || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { driveId: string; itemId: string } }
) {
  try {
    // Get access token from cookie
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response('Unauthorized - No access token', { status: 401 })
    }

    const { driveId, itemId } = params
    
    // First get the download URL
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to fetch file:', response.status, await response.text())
      return new Response('Failed to fetch file details', { status: response.status })
    }

    const data = await response.json()
    
    // Return the download URL which can be used directly in an iframe
    return new Response(JSON.stringify({ url: data['@microsoft.graph.downloadUrl'] }), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Preview error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
} 