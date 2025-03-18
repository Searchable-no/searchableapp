import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/microsoft-graph';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  try {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Fetch Teams from Microsoft Graph
    const teams = await getAllTeams(user.id);
    
    return NextResponse.json({
      success: true,
      data: teams.map(team => ({
        id: team.id,
        name: team.displayName,
        type: 'teams',
        description: team.description || '',
        // Teams URLs typically follow this pattern
        url: `https://teams.microsoft.com/l/team/${team.id}/conversations`
      }))
    });
  } catch (error: unknown) {
    console.error('Error fetching Teams:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Teams';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 