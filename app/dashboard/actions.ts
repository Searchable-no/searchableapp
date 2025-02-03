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

export async function getData() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user?.email) {
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

  try {
    const [emails, teamsMessages, channelMessages, events, files, plannerTasks] = await Promise.all([
      getRecentEmails(userData.id),
      getRecentTeamsMessages(userData.id),
      getRecentTeamsChannelMessages(userData.id),
      getCalendarEvents(userData.id),
      getRecentFiles(userData.id),
      getRecentPlannerTasks(userData.id)
    ])

    return {
      emails,
      teamsMessages,
      channelMessages,
      events,
      files,
      plannerTasks,
      userId: userData.id,
      error: null
    }
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error)
    return {
      emails: [],
      teamsMessages: [],
      channelMessages: [],
      events: [],
      files: [],
      plannerTasks: [],
      userId: userData.id,
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
  console.log('Starting updatePlannerTask with:', { userId, taskId, updates })
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  try {
    console.log('Fetching Microsoft connection for user:', userId)
    // Get user's Microsoft connection
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'microsoft')
      .single()

    if (connectionError) {
      console.error('Failed to fetch Microsoft connection:', connectionError)
      throw new Error(`Failed to fetch Microsoft connection: ${connectionError?.message || 'Unknown error'}`)
    }

    const accessToken = connection.access_token
    const graphClient = await getGraphClient(accessToken)

    // First get the current task to get the etag
    const currentTask = await graphClient
      .api(`/planner/tasks/${taskId}`)
      .get()

    console.log('Current task:', currentTask)

    // Prepare the update object
    const updateObject: any = {}
    if (typeof updates.percentComplete === 'number') updateObject.percentComplete = updates.percentComplete
    if (typeof updates.priority === 'number') updateObject.priority = updates.priority
    if (updates.description !== undefined) updateObject.description = updates.description
    if (updates.dueDateTime !== undefined) {
      updateObject.dueDateTime = updates.dueDateTime
      console.log('Setting due date to:', updates.dueDateTime)
    }

    console.log('Update object:', updateObject)

    // Update the task with If-Match header
    const response = await graphClient
      .api(`/planner/tasks/${taskId}`)
      .header('If-Match', currentTask['@odata.etag'])
      .patch(updateObject)

    console.log('Update response:', response)

    // Revalidate the dashboard page to show updated data
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error: any) {
    console.error('Error in updatePlannerTask:', error)
    return {
      success: false,
      error: {
        message: error.message || 'Failed to update task',
        details: error
      }
    }
  }
}

export { getTaskComments, addTaskComment } 