'use server'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { PostgrestError } from '@supabase/supabase-js'
import { 
  getRecentEmails, 
  getRecentTeamsMessages, 
  getRecentTeamsChannelMessages,
  getRecentFiles,
  getCalendarEvents,
  getRecentPlannerTasks,
  getGraphClient,
  getTaskComments,
  addTaskComment,
} from '@/lib/microsoft-graph'
import { revalidatePath } from 'next/cache'
import { TileType } from '@/lib/database.types'

// Helper function to get data for specific tile types
export async function getData(tileTypes?: TileType[]) {
  console.log(`getData called with tileTypes: ${tileTypes?.join(', ') || 'all'}`);
  
  const start = Date.now();
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user?.email) {
    console.error('Auth error in getData:', error);
    return {
      emails: [],
      teamsMessages: [],
      channelMessages: [],
      events: [],
      files: [],
      plannerTasks: [],
      userId: null,
      error: 'Not authenticated'
    }
  }

  // Get user ID from database
  const { data: userData, error: userDbError } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .single()

  if (userDbError || !userData) {
    console.error('User DB error in getData:', userDbError);
    return {
      emails: [],
      teamsMessages: [],
      channelMessages: [],
      events: [],
      files: [],
      plannerTasks: [],
      userId: null,
      error: 'User not found in database'
    }
  }

  // Check if user has Microsoft connection
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('*')
    .eq('user_id', userData.id)
    .eq('provider', 'microsoft')
    .single()

  if (connectionError || !connection) {
    console.error('Microsoft connection error in getData:', connectionError);
    return {
      emails: [],
      teamsMessages: [],
      channelMessages: [],
      events: [],
      files: [],
      plannerTasks: [],
      userId: userData.id,
      error: 'Microsoft account not connected'
    }
  }

  // Define the default result object
  const result = {
    emails: [],
    teamsMessages: [],
    channelMessages: [],
    events: [],
    files: [],
    plannerTasks: [],
    userId: userData.id,
    error: null
  }

  try {
    // Create a mapping of fetch functions by tile type
    const fetchFunctions: Record<TileType, () => Promise<any>> = {
      email: async () => ({ emails: await getRecentEmails(userData.id) }),
      teams_message: async () => ({ teamsMessages: await getRecentTeamsMessages(userData.id) }),
      teams_channel: async () => ({ channelMessages: await getRecentTeamsChannelMessages(userData.id) }),
      calendar: async () => ({ events: await getCalendarEvents(userData.id) }),
      files: async () => ({ files: await getRecentFiles(userData.id) }),
      planner: async () => ({ plannerTasks: await getRecentPlannerTasks(userData.id) })
    }

    // If specific tile types are requested, only fetch those
    const tilesToFetch = tileTypes && tileTypes.length > 0 
      ? tileTypes
      : Object.keys(fetchFunctions) as TileType[];
    
    // Log what we're fetching
    console.log(`Fetching dashboard data for tiles: ${tilesToFetch.join(', ')}`);
    
    // Fetch data for each requested tile type in parallel
    const fetchPromises = tilesToFetch.map(async (tileType) => {
      try {
        console.log(`Starting fetch for ${tileType}`);
        const tileStart = Date.now();
        const tileData = await fetchFunctions[tileType]();
        const tileEnd = Date.now();
        console.log(`Completed fetch for ${tileType} in ${tileEnd - tileStart}ms`);
        return tileData;
      } catch (error) {
        console.error(`Error fetching data for ${tileType}:`, error);
        return {} // Return empty object for this tile if fetch fails
      }
    })
    
    const results = await Promise.all(fetchPromises);
    
    // Merge all results
    const mergedResult = results.reduce((acc, curr) => ({ ...acc, ...curr }), result);
    
    const end = Date.now();
    console.log(`getData completed in ${end - start}ms for ${tilesToFetch.length} tiles`);
    
    return mergedResult;
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    return {
      ...result,
      error: error.message || 'Error fetching data'
    }
  }
}

export async function updatePlannerTask(
  userId: string,
  taskId: string,
  updates: {
    percentComplete?: number
    priority?: number
    dueDateTime?: string | null
    description?: string
  }
) {
  console.log('Starting updatePlannerTask with:', { userId, taskId, updates });
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  try {
    console.log('Fetching Microsoft connection for user:', userId);
    // Get user's Microsoft connection
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single()

    if (connectionError) {
      console.error('Failed to fetch Microsoft connection:', connectionError);
      throw new Error(`Failed to fetch Microsoft connection: ${connectionError?.message || 'Unknown error'}`);
    }

    if (!connection?.access_token) {
      throw new Error('Microsoft access token not found');
    }

    const accessToken = connection.access_token;
    const graphClient = await getGraphClient(accessToken);

    // First get the current task to get the etag
    console.log('Fetching current task to get etag');
    let currentTask;
    try {
      currentTask = await graphClient
        .api(`/planner/tasks/${taskId}`)
        .get();
    } catch (error: any) {
      console.error('Error fetching task for etag:', error);
      throw new Error(`Could not fetch task: ${error.message || 'Unknown error'}`);
    }

    console.log('Current task:', { 
      id: currentTask.id, 
      title: currentTask.title,
      etag: currentTask['@odata.etag'] 
    });

    if (!currentTask['@odata.etag']) {
      throw new Error('Task etag not found - cannot update task');
    }

    // Prepare the update object
    const updateObject: any = {};
    if (typeof updates.percentComplete === 'number') updateObject.percentComplete = updates.percentComplete;
    if (typeof updates.priority === 'number') updateObject.priority = updates.priority;
    if (updates.description !== undefined) updateObject.description = updates.description;
    if (updates.dueDateTime !== undefined) {
      updateObject.dueDateTime = updates.dueDateTime;
      console.log('Setting due date to:', updates.dueDateTime);
    }

    console.log('Update object:', updateObject);

    // If trying to update description, we need a different endpoint
    let response;
    
    if (updates.description !== undefined) {
      console.log('Updating task details (description)');
      try {
        // First get the current task details to get its etag
        const currentDetails = await graphClient
          .api(`/planner/tasks/${taskId}/details`)
          .get();
          
        console.log('Current details etag:', currentDetails['@odata.etag']);
        
        // Update the task details
        response = await graphClient
          .api(`/planner/tasks/${taskId}/details`)
          .header('If-Match', currentDetails['@odata.etag'])
          .patch({
            description: updates.description
          });
          
        console.log('Description update successful');
      } catch (error: any) {
        console.error('Error updating task description:', error);
        throw new Error(`Failed to update task description: ${error.message || 'Unknown error'}`);
      }
      
      // Remove description from the main task update
      delete updateObject.description;
    }
    
    // Only update the main task if we have properties to update
    if (Object.keys(updateObject).length > 0) {
      console.log('Updating main task properties');
      try {
        // Update the task with If-Match header
        response = await graphClient
          .api(`/planner/tasks/${taskId}`)
          .header('If-Match', currentTask['@odata.etag'])
          .patch(updateObject);
          
        console.log('Task update successful');
      } catch (error: any) {
        console.error('Error updating task properties:', error);
        throw new Error(`Failed to update task properties: ${error.message || 'Unknown error'}`);
      }
    }

    console.log('Task update completed successfully');

    // Revalidate the dashboard page to show updated data
    revalidatePath('/dashboard')
    
    return { success: true };
  } catch (error: any) {
    console.error('Error in updatePlannerTask:', error);
    return {
      success: false,
      error: {
        message: error.message || 'Failed to update task',
        details: error
      }
    };
  }
}

// Function to refresh a specific tile type
export async function refreshTileData(tileType: TileType) {
  console.log(`Refreshing tile data for: ${tileType}`);
  try {
    const data = await getData([tileType]);
    return data;
  } catch (error) {
    console.error(`Error refreshing ${tileType}:`, error);
    return { error: `Failed to refresh ${tileType}` };
  }
}

export { getTaskComments, addTaskComment } 