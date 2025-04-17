import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getEmailThread } from '@/lib/microsoft-graph'

export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get('conversationId')
  
  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversationId parameter' },
      { status: 400 }
    )
  }

  try {
    // Get the authenticated user
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user?.email) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get the user ID from the database
    const { data: userData, error: userDbError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single()

    if (userDbError || !userData) {
      console.error('User DB error:', userDbError)
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Fetch the complete email thread
    const emails = await getEmailThread(userData.id, conversationId)
    
    return NextResponse.json({ emails })
  } catch (error) {
    console.error('Error fetching email thread:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email thread' },
      { status: 500 }
    )
  }
} 