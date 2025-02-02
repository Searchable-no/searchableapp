import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    console.log('Received disconnect request');
    const body = await request.json();
    console.log('Request body:', body);
    
    const { email } = body;
    
    if (!email) {
      console.log('No email provided in request');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('Disconnecting Microsoft for user:', email)

    // Find the user - get the most recently created one if multiple exist
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (userError) {
      console.log('Error finding user:', userError);
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('No user found for email:', email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = users[0];
    console.log('Found user:', user.id)

    // Delete the connection
    const { error: deleteError } = await supabase
      .from('connections')
      .delete()
      .match({ user_id: user.id, provider: 'microsoft' })

    if (deleteError) {
      console.error('Error deleting connection:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true
    })
  } catch (error) {
    console.error('Error disconnecting Microsoft:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Microsoft' },
      { status: 500 }
    )
  }
} 