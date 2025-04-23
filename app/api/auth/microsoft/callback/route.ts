import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { indexMicrosoftContent, createChangeNotificationSubscriptions } from '@/lib/microsoft'

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') // Format: 'tenantId:organizationId'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 500 }
    )
  }

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?error=no_code`)
  }

  try {
    // Parse state parameter for tenant-specific flow
    let tenantId = 'common'
    let organizationId: string | undefined

    if (state && state.includes(':')) {
      const parts = state.split(':')
      tenantId = parts[0]
      organizationId = parts[1]
    }

    // Hent token fra Microsoft
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID!,
        client_secret: MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange error:', errorData)
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token exchange successful')

    // Get user info from the id token
    const idToken = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString())
    const userEmail = idToken.email.toLowerCase()
    const userName = idToken.name
    const microsoftTenantId = idToken.tid

    console.log('User info from token:', { userEmail, userName, microsoftTenantId })

    // Hent innlogget bruker fra Supabase
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=auth_required&redirectTo=/settings`)
    }

    // Sjekk om vi har tenant-spesifikk flyt
    if (organizationId) {
      // Sjekk at brukeren har tilgang til denne organisasjonen
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
        return NextResponse.redirect(`${baseUrl}/settings/organizations?error=unauthorized_organization`)
      }

      // Oppdater organisasjonen med Microsoft tenant ID
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          ms_tenant_id: microsoftTenantId,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)

      if (updateError) {
        console.error('Feil ved kobling av organisasjon til Microsoft:', updateError)
        return NextResponse.redirect(`${baseUrl}/settings/organizations/${organizationId}?error=tenant_connection_failed`)
      }
    }

    // Opprett eller oppdater Microsoft-tilkobling for brukeren
    const { error: connectionError } = await supabaseAdmin
      .from('connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'microsoft',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          metadata: {
            scope: tokenData.scope,
            tenant_id: microsoftTenantId,
            organization_id: organizationId // Lagrer organisasjons-ID hvis tilgjengelig
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,provider',
        }
      )

    if (connectionError) {
      console.error('Error upserting connection:', connectionError)
      return NextResponse.redirect(
        new URL(`/settings?error=connection_update_failed`, baseUrl)
      )
    }

    try {
      // Create change notification subscriptions
      await createChangeNotificationSubscriptions(user.id, tokenData.access_token)
      console.log('Created change notification subscriptions')

      // Start content indexing in the background
      indexMicrosoftContent(user.id)
        .catch(error => console.error('Error starting content indexing:', error))
      
      console.log('Started content indexing')
    } catch (error) {
      console.error('Error in post-connection setup:', error)
      // Continue with the flow even if subscriptions or indexing fails
    }

    // Rediriger basert på om dette var en tenant-spesifikk flyt
    if (organizationId) {
      return NextResponse.redirect(`${baseUrl}/settings/organizations/${organizationId}?success=microsoft_connected`)
    } else {
      return NextResponse.redirect(`${baseUrl}/settings?success=true`)
    }
  } catch (error) {
    console.error('Error in Microsoft callback:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=unexpected_error`)
  }
} 