import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSharePointSites } from '@/lib/microsoft-graph';

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
    
    // Fetch SharePoint sites from Microsoft Graph
    const sites = await getSharePointSites(user.id);
    
    return NextResponse.json({
      success: true,
      data: sites.map(site => ({
        id: site.id,
        name: site.displayName,
        type: 'sharepoint',
        url: site.webUrl
      }))
    });
  } catch (error: unknown) {
    console.error('Error fetching SharePoint sites:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch SharePoint sites';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 