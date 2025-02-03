import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { addTeamMember } from '@/lib/microsoft-graph'

export async function POST(request: Request) {
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
    
    // Get request body
    const { teamId, memberEmail } = await request.json()
    
    if (!teamId || !memberEmail) {
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

    // Add the member to the team
    await addTeamMember(userData.id, teamId, memberEmail)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error adding team member:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add team member' },
      { status: 500 }
    )
  }
} 