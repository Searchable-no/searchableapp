import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    console.log('Looking for users with email:', email)

    // Get all users with this email
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*, connections(*)')
      .ilike('email', email)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    console.log('Found users:', JSON.stringify(users, null, 2))

    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        connections: user.connections
      }))
    })
  } catch (error) {
    console.error('Error in users test endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 