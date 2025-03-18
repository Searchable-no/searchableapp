import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/server-actions';
import { getGraphClient } from '@/lib/microsoft-graph';

// Define proper types
interface MicrosoftGroup {
  id: string;
  displayName: string;
  [key: string]: any; // For additional properties
}

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
    
    // Get access token and graph client
    const accessToken = await getValidAccessToken(user.id);
    const graphClient = await getGraphClient(accessToken);
    
    // First, get the user's groups (without using the filter that's causing the error)
    const groupsResponse = await graphClient
      .api('/me/memberOf')
      .select('id,displayName')
      .get();
      
    const groups = groupsResponse.value.filter((group: MicrosoftGroup) => 
      // Filter teams/groups manually instead of using the problematic filter
      group['@odata.type'] === '#microsoft.graph.group'
    );
    
    // Array to store all plans
    const plans = [];
    
    // For each group, get the associated plans
    for (const group of groups) {
      try {
        const plansResponse = await graphClient
          .api(`/groups/${group.id}/planner/plans`)
          .select('id,title')
          .get();
        
        // Add group details to each plan
        for (const plan of plansResponse.value) {
          plans.push({
            id: plan.id,
            name: plan.title,
            type: 'planner',
            groupId: group.id,
            groupName: group.displayName,
            url: `https://tasks.office.com/Home/PlanViews/${plan.id}`
          });
        }
      } catch (error) {
        // If this specific group doesn't have plans or we don't have access, continue
        console.error(`Error fetching plans for group ${group.id}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: plans
    });
  } catch (error: unknown) {
    console.error('Error fetching Planner plans:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Planner plans';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 