import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Connection {
  provider: string;
  expires_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.toLowerCase();

  if (!email) {
    console.error('No email provided in request');
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  console.log('Checking connections for email:', email);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, connections(*)')
    .eq('email', email)
    .single();

  if (userError) {
    console.log('No user found for email:', email);
    return NextResponse.json({ microsoft: false });
  }

  if (!user) {
    console.log('No user found for email:', email);
    return NextResponse.json({ microsoft: false });
  }

  console.log('Found user with connections:', user.connections?.length || 0);

  const connections = (user.connections || []) as Connection[];
  const status = {
    microsoft: false,
  };

  connections.forEach((conn) => {
    if (conn.provider === 'microsoft') {
      status[conn.provider as keyof typeof status] = true;
    }
  });

  return NextResponse.json(status);
} 