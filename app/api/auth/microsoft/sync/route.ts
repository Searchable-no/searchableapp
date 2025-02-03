import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Get token data from request
    const { access_token, expires_at } = await request.json()
    
    if (!access_token || !expires_at) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get user ID from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email.toLowerCase())
      .single()
      
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Update or create Microsoft connection
    const { error: connectionError } = await supabase
      .from('connections')
      .upsert(
        {
          user_id: userData.id,
          provider: 'microsoft',
          access_token,
          expires_at,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,provider',
        }
      )
      
    if (connectionError) {
      return NextResponse.json(
        { error: 'Failed to update connection' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in sync endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 