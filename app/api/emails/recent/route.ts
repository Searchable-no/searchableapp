import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getRecentEmails } from '@/lib/microsoft-graph';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { data: userData, error: userDbError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();
      
    if (userDbError || !userData) {
      console.error('User DB error:', userDbError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const emails = await getRecentEmails(userData.id);
    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error fetching recent emails:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
} 