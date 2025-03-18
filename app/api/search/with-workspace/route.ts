import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { searchSharePointFiles, searchPlannerTasks, type SearchResult } from '@/lib/microsoft-graph';

export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const url = new URL(req.url);
  
  // Get query and workspace ID from URL params
  const query = url.searchParams.get('query') || url.searchParams.get('q');
  const workspaceId = url.searchParams.get('workspace');
  
  if (!query) {
    return NextResponse.json({ 
      success: false, 
      error: 'Query parameter is required' 
    }, { status: 400 });
  }
  
  if (!workspaceId) {
    return NextResponse.json({ 
      success: false, 
      error: 'Workspace parameter is required' 
    }, { status: 400 });
  }
  
  try {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    // Get the workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();
    
    if (workspaceError || !workspace) {
      return NextResponse.json({ 
        success: false, 
        error: 'Workspace not found' 
      }, { status: 404 });
    }
    
    // Get workspace resources
    const { data: resources, error: resourcesError } = await supabase
      .from('workspace_resources')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    if (resourcesError) {
      throw resourcesError;
    }
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No resources in this workspace'
      });
    }
    
    // Group resources by type
    const sharepointSites = resources
      .filter(r => r.resource_type === 'sharepoint')
      .map(r => r.resource_id);
    
    // Also get full resource URLs when available (more reliable for matching)
    const sharepointUrls = resources
      .filter(r => r.resource_type === 'sharepoint' && r.resource_url)
      .map(r => {
        // Extract hostname and path from URLs
        try {
          const url = new URL(r.resource_url!);
          return url.hostname + url.pathname.split('/').slice(0, 3).join('/');
        } catch {
          return r.resource_url;
        }
      });
    
    // Get planner plans
    const plannerPlans = resources
      .filter(r => r.resource_type === 'planner')
      .map(r => r.resource_id);
    
    console.log('Workspace SharePoint sites:', sharepointSites);
    console.log('Workspace SharePoint URLs:', sharepointUrls);
    console.log('Workspace Planner plans:', plannerPlans);
    
    // Initialize results array
    let results: SearchResult[] = [];
    
    // 1. Search in SharePoint sites if we have any
    if (sharepointSites.length > 0 || sharepointUrls.length > 0) {
      const sharepointResults = await searchSharePointFiles(user.id, query);
      console.log('SharePoint search results count:', sharepointResults.length);
      
      // Filter results to only include those from the workspace's resources
      const filteredSharePointResults = sharepointResults.filter(result => {
        if (!result.webUrl) return false;
        
        // Try to normalize the result URL for matching
        let resultUrl = result.webUrl.toLowerCase();
        try {
          const url = new URL(resultUrl);
          // Match based on hostname and first parts of path (site collection)
          resultUrl = url.hostname + url.pathname.split('/').slice(0, 3).join('/');
        } catch {
          // If URL parsing fails, just use the original
        }
        
        // Method 1: Check by site ID
        const matchesBySiteId = sharepointSites.some(siteId => {
          const siteIdFormats = [
            siteId,
            siteId.replace(/[{}]/g, ''), // Remove braces if present
            siteId.split(',')[0],        // Use first part if compound ID
          ];
          
          return siteIdFormats.some(format => 
            result.webUrl!.toLowerCase().includes(format.toLowerCase())
          );
        });
        
        // Method 2: Check by site URL
        const matchesBySiteUrl = sharepointUrls.some(siteUrl => 
          resultUrl.includes(siteUrl!.toLowerCase())
        );
        
        const isMatch = matchesBySiteId || matchesBySiteUrl;
        
        if (isMatch) {
          console.log('SharePoint match found for result:', result.name, '- URL:', result.webUrl);
        }
        
        return isMatch;
      });
      
      console.log('Filtered SharePoint results count:', filteredSharePointResults.length);
      
      // Add filtered SharePoint results to the main results array
      results = [...results, ...filteredSharePointResults];
    }
    
    // 2. Search in Planner plans if we have any
    if (plannerPlans.length > 0) {
      try {
        const plannerResults = await searchPlannerTasks(user.id, query);
        console.log('Planner search results count:', plannerResults.length);
        
        // Filter results to only include those from the workspace's resources
        const filteredPlannerResults = plannerResults.filter(result => {
          // Check if the task belongs to one of our plans
          if (plannerPlans.includes(result.planId)) {
            console.log('Planner match found for task:', result.title, '- Plan ID:', result.planId);
            return true;
          }
          return false;
        });
        
        console.log('Filtered Planner results count:', filteredPlannerResults.length);
        
        // Add filtered Planner results to the main results array
        results = [...results, ...filteredPlannerResults];
      } catch (error) {
        console.error('Error searching Planner tasks:', error);
        // Continue with SharePoint results even if Planner search fails
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      workspace: workspace.name,
      debug: {
        siteIds: sharepointSites,
        siteUrls: sharepointUrls,
        plannerPlans: plannerPlans,
        totalMatchesFound: results.length
      }
    });
  } catch (error: unknown) {
    console.error('Error searching with workspace filter:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search with workspace filter';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 