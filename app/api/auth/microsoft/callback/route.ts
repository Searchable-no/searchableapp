import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { indexMicrosoftContent } from '@/lib/microsoft'

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
    const userEmail = idToken.email
    const userName = idToken.name

    console.log('User info from token:', { userEmail, userName })

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      create: {
        email: userEmail,
        name: userName,
      },
      update: {
        name: userName,
      },
    })

    console.log('User upserted:', user)

    // Create or update connection
    const connection = await prisma.connection.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'microsoft',
        },
      },
      create: {
        provider: 'microsoft',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        userId: user.id,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    })

    console.log('Connection upserted:', connection)

    try {
      // Start content indexing and wait for it to complete
      console.log('Starting content indexing for user:', user.id)
      console.log('User email:', userEmail)
      console.log('Access token available:', !!tokenData.access_token)
      
      await indexMicrosoftContent(user.id)
      console.log('Indexing completed successfully')
      
      return NextResponse.redirect(
        `${baseUrl}/settings?success=true&indexed=true`
      )
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown indexing error'
      console.error('Indexing error:', error)
      // Still redirect but with error flag
      return NextResponse.redirect(
        `${baseUrl}/settings?success=true&indexed=false&error=${encodeURIComponent(errorMessage)}`
      )
    }
  } catch (error) {
    console.error('Error exchanging code for token:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
  }
} 