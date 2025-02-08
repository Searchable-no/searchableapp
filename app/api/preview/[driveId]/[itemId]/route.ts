import { NextRequest } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createServerComponentClient({ cookies })
    // get current user session (you can also use getUser() if that suits your setup)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.email) {
      console.error('No session found:', sessionError)
      return null
    }
    // get user id from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email.toLowerCase())
      .single()
    if (userError || !userData) {
      console.error('User not found:', userError)
      return null
    }
    // get microsoft connection
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('access_token, expires_at')
      .eq('user_id', userData.id)
      .eq('provider', 'microsoft')
      .single()
    if (connectionError || !connection) {
      console.error('Microsoft connection not found:', connectionError)
      return null
    }
    // check if token is expired
    const now = new Date()
    const expiresAt = new Date(connection.expires_at)
    if (expiresAt <= now) {
      console.error('Token is expired')
      return null
    }
    return connection.access_token
  } catch (error) {
    console.error('Error getting access token:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { driveId: string; itemId: string } }
) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return new Response('Unauthorized - No access token', { status: 401 })
    }

    const { driveId, itemId } = params
    const url = new URL(request.url)
    // optional site id for sharepoint files
    const siteId = url.searchParams.get('siteId')

    // use encodeURIComponent when constructing the endpoints
    const safeDriveId = encodeURIComponent(driveId)
    const safeItemId = encodeURIComponent(itemId)

    let endpoint = ''
    let previewEndpoint = ''

    if (siteId) {
      endpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${safeDriveId}/items/${safeItemId}`
      previewEndpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${safeDriveId}/items/${safeItemId}/preview`
    } else if (driveId.startsWith('b!')) {
      // if no site id is provided but the drive id indicates sharepoint (starts with "b!"),
      // instruct the caller to supply a site id
      console.error('Site id required for sharepoint drive')
      return new Response(
        JSON.stringify({ error: 'Site id is required for sharepoint drives.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      // otherwise assume it's a onedrive file
      endpoint = `https://graph.microsoft.com/v1.0/drives/${safeDriveId}/items/${safeItemId}`
      previewEndpoint = `https://graph.microsoft.com/v1.0/drives/${safeDriveId}/items/${safeItemId}/preview`
    }

    // fetch file metadata
    const fileResponse = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!fileResponse.ok) {
      const errorData = await fileResponse.json()
      console.error('Failed to fetch file metadata:', {
        status: fileResponse.status,
        error: errorData,
        driveId,
        itemId,
        endpoint
      })
      return new Response(JSON.stringify({ error: errorData }), {
        status: fileResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fileData = await fileResponse.json()

    // fetch preview url using the preview api
    const previewResponse = await fetch(previewEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zoom: 100,
        allowEdit: false
      })
    })

    if (previewResponse.ok) {
      const previewData = await previewResponse.json()
      if (previewData.getUrl) {
        return new Response(JSON.stringify({ url: previewData.getUrl }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // fallback to download URL from file metadata if preview is not available
    return new Response(
      JSON.stringify({ url: fileData['@microsoft.graph.downloadUrl'] }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Preview error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
