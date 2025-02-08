import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function getAccessToken() {
  try {
    const supabase = createServerComponentClient({ cookies })
    // get current user using getUser() instead of getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      console.error('no user found:', userError)
      return null
    }
    // get user id from database
    const { data: userData, error: userError2 } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single()
    if (userError2 || !userData) {
      console.error('user not found:', userError2)
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
      console.error('microsoft connection not found:', connectionError)
      return null
    }
    // check if token is expired
    const now = new Date()
    const expiresAt = new Date(connection.expires_at)
    if (expiresAt <= now) {
      console.error('token is expired')
      return null
    }
    return connection.access_token
  } catch (error) {
    console.error('error getting access token:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const driveId = searchParams.get('driveId')
    // optional: if you know the site id, pass it as a query parameter
    const siteId = searchParams.get('siteId')

    if (!fileId || !driveId) {
      console.error('missing required parameters:', { fileId, driveId })
      return NextResponse.json(
        { error: 'file id and drive id are required' },
        { status: 400 }
      )
    }

    const token = await getAccessToken()
    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized - no access token' },
        { status: 401 }
      )
    }

    let endpoint = ''
    let previewEndpoint = ''

    if (siteId) {
      // if a site id is provided, use that sharepoint endpoint
      endpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${encodeURIComponent(
        driveId
      )}/items/${encodeURIComponent(fileId)}`
      previewEndpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${encodeURIComponent(
        driveId
      )}/items/${encodeURIComponent(fileId)}/preview`
    } else if (driveId.startsWith('b!')) {
      // For SharePoint files without a site ID, use the root site ID and get the Shared Documents library
      const rootSiteId = 'searchableno.sharepoint.com,69958bea-9ab8-4370-8938-81f766d04db9,f476640c-7cfa-4b79-8166-026b73738f4a'
      
      // First get the Shared Documents library drive
      const drivesResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${rootSiteId}/drives`,
        {
          headers: {
            'authorization': `bearer ${token}`,
            'accept': 'application/json'
          }
        }
      )

      if (!drivesResponse.ok) {
        console.error('Failed to fetch drives:', await drivesResponse.json())
        return NextResponse.json(
          { error: 'Failed to fetch document library information' },
          { status: 500 }
        )
      }

      const drives = await drivesResponse.json()
      const documentsLibrary = drives.value.find((drive: any) => 
        drive.name === 'Documents' || drive.name === 'Shared Documents'
      )

      if (!documentsLibrary) {
        console.error('Could not find Documents library:', drives)
        return NextResponse.json(
          { error: 'Could not find Documents library' },
          { status: 500 }
        )
      }

      endpoint = `https://graph.microsoft.com/v1.0/sites/${rootSiteId}/drives/${documentsLibrary.id}/items/${encodeURIComponent(fileId)}`
      previewEndpoint = `https://graph.microsoft.com/v1.0/sites/${rootSiteId}/drives/${documentsLibrary.id}/items/${encodeURIComponent(fileId)}/preview`
    } else {
      // otherwise assume it's a onedrive file
      endpoint = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
        driveId
      )}/items/${encodeURIComponent(fileId)}`
      previewEndpoint = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
        driveId
      )}/items/${encodeURIComponent(fileId)}/preview`
    }

    // fetch file metadata
    const fileResponse = await fetch(endpoint, {
      headers: {
        'authorization': `bearer ${token}`,
        'accept': 'application/json'
      }
    })

    if (!fileResponse.ok) {
      const errorData = await fileResponse.json()
      console.error('failed to fetch file metadata:', {
        status: fileResponse.status,
        error: errorData,
        driveId,
        fileId,
        endpoint
      })
      return NextResponse.json({ error: errorData }, { status: fileResponse.status })
    }

    const fileData = await fileResponse.json()

    // fetch preview url
    const previewResponse = await fetch(previewEndpoint, {
      method: 'post',
      headers: {
        'authorization': `bearer ${token}`,
        'content-type': 'application/json'
      }
    })

    if (previewResponse.ok) {
      const previewData = await previewResponse.json()
      if (previewData.getUrl) {
        return NextResponse.json(
          { previewUrl: previewData.getUrl },
          { headers: { 'content-type': 'application/json' } }
        )
      }
    }

    // fall back to webUrl if preview not available
    return NextResponse.json(
      { previewUrl: fileData.webUrl },
      { headers: { 'content-type': 'application/json' } }
    )
  } catch (error) {
    console.error(
      'preview error:',
      error instanceof Error ? error.message : String(error) || 'failed to generate preview'
    )
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : String(error) || 'failed to generate preview'
      },
      { status: 500 }
    )
  }
}
