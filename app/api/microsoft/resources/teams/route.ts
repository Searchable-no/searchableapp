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
      console.error('No user found in session');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Get user_id from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();
      
    if (userError || !userData) {
      console.error('Error fetching user from database:', userError);
      return NextResponse.json({ 
        success: false, 
        error: 'User not found in database' 
      }, { status: 404 });
    }
    
    console.log(`Fetching Teams for user ${userData.id}`);
    
    // Fetch Teams from Microsoft Graph
    const teams = await getAllTeams(userData.id);
    console.log(`Found ${teams.length} teams for user ${userData.id}`);
    
    // Match the expected format in the client - teams should be the top level key
    return NextResponse.json({
      success: true,
      teams: teams.map(team => ({
        id: team.id,
        displayName: team.displayName,
        description: team.description || '',
        createdDateTime: team.createdDateTime
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