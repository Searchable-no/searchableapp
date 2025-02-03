import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { indexMicrosoftContent, createChangeNotificationSubscriptions } from '@/lib/microsoft'

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
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
    const tokenResponse = await fetch(TOKEN_URL, {
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
    console.log('Token exchange successful:', tokenData)

    // Get user info from the id token
    const idToken = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString())
    const userEmail = idToken.email.toLowerCase()
    const userName = idToken.name

    console.log('User info from token:', { userEmail, userName })

    // Check if user exists
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select()
      .eq('email', userEmail)
      .single()

    if (userError) {
      console.log('Error checking for existing user:', userError)
    }

    let user = existingUser

    if (!user) {
      // Create new user if doesn't exist
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email: userEmail,
            name: userName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (createError) {
        console.error('Error creating new user:', createError)
        return NextResponse.redirect(
          new URL(`/settings?error=user_creation_failed`, baseUrl)
        )
      }

      console.log('Created new user:', newUser)
      user = newUser
    }

    // Update or create Microsoft connection
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

    return NextResponse.redirect(`${baseUrl}/settings?success=true`)
  } catch (error) {
    console.error('Error in Microsoft callback:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=unexpected_error`)
  }
} 