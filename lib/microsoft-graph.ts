'use server'

import { Client } from '@microsoft/microsoft-graph-client'
import { getValidAccessToken } from './supabase-server'

const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export interface EmailMessage {
  id: string
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  receivedDateTime: string
  bodyPreview: string
  webLink?: string
  isRead: boolean
}

export interface TeamsMessage {
  id: string
  content?: string
  body?: {
    content: string
    contentType?: string
  }
  from?: {
    user?: {
      displayName: string
    }
  }
  createdDateTime: string
  channelIdentity?: {
    channelId: string
    teamId: string
  }
  channelDisplayName?: string
  teamDisplayName?: string
  webUrl?: string
}

export interface TeamsChannelMessage extends TeamsMessage {
  teamName: string
  channelName: string
}

export interface RecentFile {
  id: string
  name: string
  webUrl: string
  lastModifiedDateTime: string
  size: number
  lastModifiedBy: {
    user: {
      displayName: string
      id: string
    }
  }
}

export interface CalendarEvent {
  id: string
  subject: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: {
    displayName: string
  }
  webLink: string
  isOnline?: boolean
  organizer: {
    emailAddress: {
      name: string
    }
  }
}

export interface PlannerTask {
  id: string
  title: string
  planId: string
  planTitle: string
  bucketId: string
  priority: number
  percentComplete: number
  dueDateTime?: string
  webUrl: string
  createdDateTime: string
  description?: string
  assignments: {
    [key: string]: {
      assignedBy: {
        user: {
          displayName: string
          id: string
        }
      }
    }
  }
}

export interface Team {
  id: string
  displayName: string
  description?: string
  visibility?: string
  createdDateTime: string
}

export interface Group {
  id: string
  displayName: string
  description?: string
  visibility?: string
  mail?: string
  groupTypes: string[]
}

export interface TeamMember {
  id: string
  displayName: string
  email?: string
  jobTitle?: string
  userPrincipalName?: string
  roles?: string[]
}

export interface PlannerTaskComment {
  id: string
  content: string
  createdDateTime: string
  user: {
    displayName: string
    id: string
  }
}

interface GraphError {
  statusCode?: number
  message?: string
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

export async function getGraphClient(accessToken: string) {
  if (!accessToken) {
    throw new Error('No access token provided')
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
    defaultVersion: 'v1.0'
  })
}

export async function getRecentEmails(userId: string) {
  console.log('Starting to fetch emails from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    const response = await graphClient
      .api('/me/messages')
      .select('id,subject,from,receivedDateTime,bodyPreview,webLink')
      .top(10)
      .orderby('receivedDateTime DESC')
      .get()

    console.log('Graph API response received:', response?.value?.length || 0, 'emails')
    
    if (!response?.value) {
      console.error('No emails found in response:', response)
      return []
    }

    return response.value as EmailMessage[]
  } catch (error) {
    console.error('Error in getRecentEmails:', error)
    const graphError = error as GraphError
    if (graphError.statusCode === 401) {
      console.error('Authentication error - token might be expired')
    }
    return []
  }
}

export async function getRecentTeamsMessages(userId: string) {
  console.log('Starting to fetch Teams messages from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // First get the chats and channels the user is part of
    const response = await graphClient
      .api('/me/chats')
      .select('id,topic,webUrl')
      .expand('lastMessagePreview')
      .top(10)
      .get()

    console.log('Graph API response received:', response?.value?.length || 0, 'chats')
    
    if (!response?.value) {
      console.error('No chats found in response:', response)
      return []
    }

    const messages: TeamsMessage[] = response.value
      .filter((chat: any) => chat.lastMessagePreview)
      .map((chat: any) => ({
        id: chat.lastMessagePreview.id,
        content: chat.lastMessagePreview.body.content,
        from: chat.lastMessagePreview.from,
        createdDateTime: chat.lastMessagePreview.createdDateTime,
        channelDisplayName: chat.topic,
        webUrl: chat.webUrl
      }))

    return messages
  } catch (error) {
    console.error('Error in getRecentTeamsMessages:', error)
    const graphError = error as GraphError
    if (graphError.statusCode === 401) {
      console.error('Authentication error - token might be expired')
    }
    return []
  }
}

export async function getRecentTeamsChannelMessages(userId: string) {
  console.log('Starting to fetch Teams channel messages from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token:', accessToken.substring(0, 10) + '...')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // Test basic Teams API access
    try {
      console.log('Testing Teams API access...')
      const testResponse = await graphClient
        .api('/me/joinedTeams')
        .select('id,displayName')
        .get()
      
      console.log('Teams API test response:', {
        status: 'success',
        teamsCount: testResponse?.value?.length || 0,
        teams: testResponse?.value?.map((t: any) => t.displayName) || []
      })
    } catch (testError: any) {
      console.error('Teams API test failed:', {
        error: testError,
        statusCode: testError.statusCode,
        message: testError.message,
        code: testError.code,
        requestId: testError.requestId,
        body: JSON.stringify(testError.body, null, 2)
      })
      return []
    }

    // First get all teams the user is part of
    console.log('Fetching teams...')
    try {
      const teamsResponse = await graphClient
        .api('/me/joinedTeams')
        .get()
      
      console.log('Teams response:', JSON.stringify(teamsResponse, null, 2))

      if (!teamsResponse?.value) {
        console.error('No teams found in response:', teamsResponse)
        return []
      }

      const messages: TeamsChannelMessage[] = []

      // For each team, get the channels and their messages
      for (const team of teamsResponse.value) {
        console.log(`Fetching channels for team: ${team.displayName} (${team.id})`)
        
        try {
          const channelsResponse = await graphClient
            .api(`/teams/${team.id}/channels`)
            .get()

          console.log(`Channels response for team ${team.displayName}:`, JSON.stringify(channelsResponse, null, 2))

          if (channelsResponse?.value) {
            for (const channel of channelsResponse.value) {
              console.log(`Fetching messages for channel: ${channel.displayName} in team ${team.displayName}`)
              
              try {
                const messagesResponse = await graphClient
                  .api(`/teams/${team.id}/channels/${channel.id}/messages`)
                  .top(5)
                  .get()

                console.log(`Messages response for channel ${channel.displayName}:`, JSON.stringify(messagesResponse, null, 2))

                if (messagesResponse?.value) {
                  const channelMessages = messagesResponse.value.map((msg: any) => ({
                    id: msg.id,
                    content: msg.body.content,
                    from: {
                      user: {
                        displayName: msg.from?.user?.displayName || 'Unknown User',
                        id: msg.from?.user?.id
                      }
                    },
                    createdDateTime: msg.createdDateTime,
                    channelIdentity: {
                      channelId: channel.id,
                      teamId: team.id
                    },
                    teamName: team.displayName,
                    channelName: channel.displayName,
                    webUrl: msg.webUrl
                  }))
                  messages.push(...channelMessages)
                }
              } catch (channelError: any) {
                console.error(`Error fetching messages for channel ${channel.displayName}:`, {
                  error: channelError,
                  statusCode: channelError.statusCode,
                  message: channelError.message,
                  code: channelError.code,
                  requestId: channelError.requestId,
                  body: JSON.stringify(channelError.body, null, 2)
                })
              }
            }
          }
        } catch (channelsError: any) {
          console.error(`Error fetching channels for team ${team.displayName}:`, {
            error: channelsError,
            statusCode: channelsError.statusCode,
            message: channelsError.message,
            code: channelsError.code,
            requestId: channelsError.requestId,
            body: JSON.stringify(channelsError.body, null, 2)
          })
        }
      }

      console.log('Total channel messages found:', messages.length)
      return messages

    } catch (teamsError: any) {
      console.error('Error fetching teams:', {
        error: teamsError,
        statusCode: teamsError.statusCode,
        message: teamsError.message,
        code: teamsError.code,
        requestId: teamsError.requestId,
        body: JSON.stringify(teamsError.body, null, 2)
      })
      return []
    }

  } catch (error: any) {
    console.error('Error in getRecentTeamsChannelMessages:', {
      error,
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      body: JSON.stringify(error.body, null, 2)
    })
    return []
  }
}

export async function getRecentFiles(userId: string): Promise<RecentFile[]> {
  console.log('Starting to fetch recent files from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')
    
    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')
    
    const allFiles: RecentFile[] = []

    // Get files from personal OneDrive
    console.log('Fetching OneDrive files...')
    const oneDriveResponse = await graphClient
      .api('/me/drive/root/children')
      .select('id,name,webUrl,lastModifiedDateTime,size,lastModifiedBy')
      .orderby('lastModifiedDateTime desc')
      .top(10)
      .get()

    console.log('OneDrive response:', JSON.stringify(oneDriveResponse, null, 2))

    if (oneDriveResponse?.value) {
      allFiles.push(...oneDriveResponse.value.map((file: any) => ({
        id: file.id,
        name: file.name,
        webUrl: file.webUrl,
        lastModifiedDateTime: file.lastModifiedDateTime,
        size: file.size,
        lastModifiedBy: {
          user: {
            displayName: file.lastModifiedBy?.user?.displayName || 'Unknown User',
            id: file.lastModifiedBy?.user?.id || ''
          }
        }
      })))
    }

    // Get all SharePoint sites
    console.log('Fetching SharePoint sites...')
    const sitesResponse = await graphClient
      .api('/sites?search=*')
      .get()

    console.log('SharePoint sites response:', JSON.stringify(sitesResponse, null, 2))

    // Loop through each site
    for (const site of sitesResponse.value || []) {
      console.log(`Processing site: ${site.displayName || site.name}`)
      
      try {
        // Get all drives (document libraries) in the site
        const drivesResponse = await graphClient
          .api(`/sites/${site.id}/drives`)
          .get()

        console.log(`Found ${drivesResponse.value?.length || 0} drives in site ${site.displayName || site.name}`)

        // Loop through each drive
        for (const drive of drivesResponse.value || []) {
          console.log(`Processing drive: ${drive.name} in site ${site.displayName || site.name}`)
          
          try {
            // Get files from the drive
            const filesResponse = await graphClient
              .api(`/drives/${drive.id}/root/children`)
              .select('id,name,webUrl,lastModifiedDateTime,size,lastModifiedBy')
              .orderby('lastModifiedDateTime desc')
              .top(10)
              .get()

            console.log(`Files from drive ${drive.name}:`, JSON.stringify(filesResponse, null, 2))

            if (filesResponse?.value) {
              allFiles.push(...filesResponse.value.map((file: any) => ({
                id: file.id,
                name: file.name,
                webUrl: file.webUrl,
                lastModifiedDateTime: file.lastModifiedDateTime,
                size: file.size,
                lastModifiedBy: {
                  user: {
                    displayName: file.lastModifiedBy?.user?.displayName || 'Unknown User',
                    id: file.lastModifiedBy?.user?.id || ''
                  }
                }
              })))
            }
          } catch (driveError) {
            console.error(`Error fetching files from drive ${drive.name}:`, driveError)
          }
        }
      } catch (siteError) {
        console.error(`Error processing site ${site.displayName || site.name}:`, siteError)
      }
    }

    // Sort all files by last modified date and take the 10 most recent
    return allFiles
      .sort((a, b) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime())
      .slice(0, 10)

  } catch (error: any) {
    console.error('Error fetching recent files:', {
      error,
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined
    })
    return []
  }
}

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  console.log('Starting to fetch calendar events from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token for calendar events')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized for calendar events')
    
    // Get date range for the next 7 days
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999)
    
    console.log('Fetching calendar events between:', {
      start: startOfToday.toISOString(),
      end: endOfWeek.toISOString()
    })

    // First get all calendars to find the primary one
    const calendarsResponse = await graphClient
      .api('/me/calendars')
      .get()
    
    console.log('Calendars response:', {
      status: 'success',
      calendarCount: calendarsResponse?.value?.length || 0,
      calendars: calendarsResponse?.value?.map((c: any) => ({
        id: c.id,
        name: c.name
      }))
    })

    // Find the primary calendar (named "Kalender")
    const primaryCalendar = calendarsResponse?.value?.find((c: any) => c.name === 'Kalender')
    if (!primaryCalendar) {
      console.error('Primary calendar not found')
      return []
    }

    // Get events only from the primary calendar
    const response = await graphClient
      .api(`/me/calendars/${primaryCalendar.id}/events`)
      .select('id,subject,start,end,location,webLink,organizer,isOnlineMeeting')
      .filter(`start/dateTime ge '${startOfToday.toISOString()}' and end/dateTime le '${endOfWeek.toISOString()}'`)
      .orderby('start/dateTime')
      .get()

    console.log('Calendar events API response:', {
      status: 'success',
      eventCount: response?.value?.length || 0,
      events: response?.value?.map((e: any) => ({
        subject: e.subject,
        start: e.start.dateTime,
        end: e.end.dateTime,
        isOnline: e.isOnlineMeeting
      }))
    })

    if (!response?.value) {
      console.log('No events found in response:', response)
      return []
    }

    return response.value.map((event: any) => ({
      id: event.id,
      subject: event.subject,
      start: event.start,
      end: event.end,
      location: event.location,
      webLink: event.webLink,
      isOnline: event.isOnlineMeeting || event.location?.displayName?.toLowerCase().includes('teams') || false,
      organizer: event.organizer
    }))
  } catch (error: any) {
    console.error('Error fetching calendar events:', {
      error,
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined
    })
    return []
  }
}

export async function getRecentPlannerTasks(userId: string): Promise<PlannerTask[]> {
  console.log('Starting to fetch planner tasks from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)
    
    // First get all plans the user has access to
    const plansResponse = await graphClient
      .api('/me/planner/plans')
      .get()

    if (!plansResponse?.value) {
      console.log('No plans found')
      return []
    }

    const plans = plansResponse.value
    const planIdToTitle = new Map(plans.map((plan: any) => [plan.id, plan.title]))

    // Get tasks assigned to the user
    const tasksResponse = await graphClient
      .api('/me/planner/tasks')
      .get()

    if (!tasksResponse?.value) {
      console.log('No tasks found')
      return []
    }

    return tasksResponse.value
      .map((task: any) => ({
        id: task.id,
        title: task.title,
        planId: task.planId,
        planTitle: planIdToTitle.get(task.planId) || 'Unknown Plan',
        bucketId: task.bucketId,
        priority: task.priority,
        percentComplete: task.percentComplete,
        dueDateTime: task.dueDateTime,
        webUrl: task.webUrl,
        createdDateTime: task.createdDateTime,
        description: task.description,
        assignments: task.assignments
      }))
      .sort((a: PlannerTask, b: PlannerTask) => {
        // Sort by due date (if exists) and then by priority
        if (a.dueDateTime && b.dueDateTime) {
          return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime()
        }
        if (a.dueDateTime) return -1
        if (b.dueDateTime) return 1
        return b.priority - a.priority
      })
      .slice(0, 10) // Get only the 10 most relevant tasks
  } catch (error) {
    console.error('Error fetching planner tasks:', error)
    return []
  }
}

export async function getTeamsMessageThread(userId: string, messageId: string) {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    // First try to find the message in chats
    const chats = await graphClient
      .api('/me/chats')
      .expand('lastMessagePreview')
      .get()

    // Find the chat containing this message
    const chat = chats.value.find((c: any) => 
      c.lastMessagePreview?.id === messageId
    )

    if (chat) {
      // This is a chat message
      const response = await graphClient
        .api(`/me/chats/${chat.id}/messages`)
        .get()

      if (!response?.value) {
        return []
      }

      // Sort messages by createdDateTime in memory
      const messages = response.value.sort((a: any, b: any) => 
        new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
      )

      return messages.map((msg: any) => ({
        id: msg.id,
        content: msg.body?.content,
        from: {
          user: {
            displayName: msg.from?.user?.displayName || 'Unknown'
          }
        },
        createdDateTime: msg.createdDateTime,
        channelDisplayName: chat.topic
      }))
    }

    // If not found in chats, try to find in channel messages
    const teams = await graphClient
      .api('/me/joinedTeams')
      .get()

    for (const team of teams.value) {
      const channels = await graphClient
        .api(`/teams/${team.id}/channels`)
        .get()

      for (const channel of channels.value) {
        try {
          // Try to get the specific message to verify it exists in this channel
          const messageResponse = await graphClient
            .api(`/teams/${team.id}/channels/${channel.id}/messages/${messageId}`)
            .get()

          if (messageResponse) {
            // Found the message, now get the thread
            const threadResponse = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages/${messageId}/replies`)
              .get()

            const replies = threadResponse.value || []
            const allMessages = [messageResponse, ...replies].sort((a: any, b: any) => 
              new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
            )

            return allMessages.map((msg: any) => ({
              id: msg.id,
              content: msg.body?.content,
              from: {
                user: {
                  displayName: msg.from?.user?.displayName || 'Unknown'
                }
              },
              createdDateTime: msg.createdDateTime,
              channelDisplayName: channel.displayName,
              teamDisplayName: team.displayName
            }))
          }
        } catch (error) {
          // Message not found in this channel, continue searching
          continue
        }
      }
    }

    console.error('Message not found in any chat or channel:', messageId)
    return []
  } catch (error) {
    console.error('Error fetching Teams message thread:', error)
    throw error
  }
}

export async function sendTeamsReply(userId: string, messageId: string, content: string) {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    // First try to find the message in chats
    const chats = await graphClient
      .api('/me/chats')
      .expand('lastMessagePreview')
      .get()

    // Find the chat containing this message
    const chat = chats.value.find((c: any) => 
      c.lastMessagePreview?.id === messageId
    )

    if (chat) {
      // This is a chat message
      const response = await graphClient
        .api(`/me/chats/${chat.id}/messages`)
        .post({
          body: {
            content,
            contentType: 'text'
          }
        })

      return {
        id: response.id,
        content: response.body?.content,
        from: {
          user: {
            displayName: response.from?.user?.displayName || 'Unknown'
          }
        },
        createdDateTime: response.createdDateTime,
        channelDisplayName: chat.topic
      }
    }

    // If not found in chats, try to find in channel messages
    const teams = await graphClient
      .api('/me/joinedTeams')
      .get()

    for (const team of teams.value) {
      const channels = await graphClient
        .api(`/teams/${team.id}/channels`)
        .get()

      for (const channel of channels.value) {
        try {
          // Try to get the specific message to verify it exists in this channel
          const messageResponse = await graphClient
            .api(`/teams/${team.id}/channels/${channel.id}/messages/${messageId}`)
            .get()

          if (messageResponse) {
            // Found the message, now reply to it
            const response = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages/${messageId}/replies`)
              .post({
                body: {
                  content,
                  contentType: 'text'
                }
              })

            return {
              id: response.id,
              content: response.body?.content,
              from: {
                user: {
                  displayName: response.from?.user?.displayName || 'Unknown'
                }
              },
              createdDateTime: response.createdDateTime,
              channelDisplayName: channel.displayName,
              teamDisplayName: team.displayName
            }
          }
        } catch (error) {
          // Message not found in this channel, continue searching
          continue
        }
      }
    }

    throw new Error('Message not found in any chat or channel')
  } catch (error) {
    console.error('Error sending Teams reply:', error)
    throw error
  }
}

export async function startNewTeamsThread(userId: string, teamId: string, channelId: string, content: string) {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    // Create a new message in the channel (this starts a new thread)
    const response = await graphClient
      .api(`/teams/${teamId}/channels/${channelId}/messages`)
      .post({
        body: {
          content,
          contentType: 'text'
        }
      })

    return {
      id: response.id,
      content: response.body?.content,
      from: {
        user: {
          displayName: response.from?.user?.displayName || 'Unknown'
        }
      },
      createdDateTime: response.createdDateTime,
      channelIdentity: {
        channelId,
        teamId
      }
    }
  } catch (error) {
    console.error('Error starting new Teams thread:', error)
    throw error
  }
}

export async function getAllTeams(userId: string): Promise<Team[]> {
  console.log('Starting to fetch teams from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // Get all teams the user is a member of
    const response = await graphClient
      .api('/me/joinedTeams')
      .select('id,displayName,description,visibility')
      .get()

    console.log('Teams response:', response?.value?.length || 0, 'teams')
    
    if (!response?.value) {
      console.error('No teams found in response:', response)
      return []
    }

    return response.value.map((team: any) => ({
      id: team.id,
      displayName: team.displayName,
      description: team.description,
      visibility: team.visibility,
      createdDateTime: team.createdDateTime
    }))
  } catch (error) {
    console.error('Error in getAllTeams:', error)
    throw error
  }
}

export async function getAllGroups(userId: string): Promise<Group[]> {
  console.log('Starting to fetch groups from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // Get all Microsoft 365 Groups the user is a member of
    const response = await graphClient
      .api('/me/memberOf')
      .select('id,displayName,description,visibility,mail,groupTypes')
      .filter('groupTypes/any(c:c eq \'Unified\')')  // Only get Microsoft 365 Groups
      .get()

    console.log('Groups response:', response?.value?.length || 0, 'groups')
    
    if (!response?.value) {
      console.error('No groups found in response:', response)
      return []
    }

    return response.value.map((group: any) => ({
      id: group.id,
      displayName: group.displayName,
      description: group.description,
      visibility: group.visibility,
      mail: group.mail,
      groupTypes: group.groupTypes || []
    }))
  } catch (error: any) {
    console.error('Error fetching groups:', {
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined
    })
    return []
  }
}

export async function getTeamMembers(userId: string, teamId: string): Promise<TeamMember[]> {
  console.log('Starting to fetch team members from Microsoft Graph...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // Get team members directly from the team
    const membersResponse = await graphClient
      .api(`/teams/${teamId}/members`)
      .get()

    console.log('Team members response:', membersResponse?.value?.length || 0, 'members')
    
    if (!membersResponse?.value) {
      console.error('No members found in response:', membersResponse)
      return []
    }

    // For each member, get their detailed user information using aadObjectId
    const members = await Promise.all(
      membersResponse.value.map(async (member: any) => {
        try {
          // Get detailed user info using the aadObjectId
          const userResponse = await graphClient
            .api(`/users/${member.aadObjectId}`)
            .select('id,displayName,mail,jobTitle,userPrincipalName')
            .get()

          return {
            id: userResponse.id,
            displayName: userResponse.displayName || member.displayName || 'Unknown User',
            email: userResponse.mail,
            jobTitle: userResponse.jobTitle,
            userPrincipalName: userResponse.userPrincipalName,
            roles: member.roles
          }
        } catch (error) {
          console.warn(`Could not fetch details for user ${member.aadObjectId}:`, error)
          // Return basic info if detailed fetch fails
          return {
            id: member.aadObjectId,
            displayName: member.displayName || 'Unknown User',
            roles: member.roles
          }
        }
      })
    )

    return members
  } catch (error: any) {
    console.error('Error fetching team members:', error)
    throw error
  }
}

export async function addTeamMember(userId: string, teamId: string, memberEmail: string): Promise<boolean> {
  console.log('Starting to add team member to Microsoft Teams...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    console.log('Got valid access token')

    const graphClient = await getGraphClient(accessToken)
    console.log('Graph client initialized')

    // First get the user's Azure AD object ID using their email
    const userResponse = await graphClient
      .api('/users')
      .filter(`mail eq '${memberEmail}' or userPrincipalName eq '${memberEmail}'`)
      .select('id')
      .get()

    if (!userResponse?.value?.[0]?.id) {
      console.error('User not found:', memberEmail)
      throw new Error('User not found')
    }

    const userAadId = userResponse.value[0].id

    // Add the user to the team
    await graphClient
      .api(`/teams/${teamId}/members`)
      .post({
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["member"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${userAadId}')`
      })

    console.log('Successfully added member to team')
    return true
  } catch (error: any) {
    console.error('Error adding team member:', error)
    throw error
  }
}

export async function getTaskComments(userId: string, taskId: string): Promise<PlannerTaskComment[]> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    const response = await graphClient
      .api(`/planner/tasks/${taskId}/details`)
      .get()

    if (!response?.comments) {
      return []
    }

    // Convert the comments object to our PlannerTaskComment format
    return Object.entries(response.comments).map(([id, comment]: [string, any]) => ({
      id,
      content: comment.message,
      createdDateTime: comment.createdDateTime,
      user: {
        displayName: comment.user.displayName,
        id: comment.user.id
      }
    }))
  } catch (error) {
    console.error('Error in getTaskComments:', error)
    return []
  }
}

export async function addTaskComment(userId: string, taskId: string, content: string): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    await graphClient
      .api(`/planner/tasks/${taskId}/details`)
      .update({
        comments: {
          [new Date().getTime().toString()]: {
            message: content,
            createdDateTime: new Date().toISOString()
          }
        }
      })

    return true
  } catch (error) {
    console.error('Error in addTaskComment:', error)
    return false
  }
}

export interface SearchResult {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  size?: number;
  type: 'file' | 'folder' | 'email' | 'chat' | 'channel' | 'planner';
  preview?: string;
  from?: {
    name?: string;
    email?: string;
  };
  location?: {
    team?: string;
    channel?: string;
  };
}

export async function searchSharePointFiles(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
    const results: SearchResult[] = [];

    // Search for files and folders
    const fileSearchResponse = await graphClient
      .api('/search/query')
      .post({
        requests: [{
          entityTypes: ['driveItem'],
          query: {
            queryString: query
          },
          from: 0,
          size: 25
        }]
      });

    if (fileSearchResponse.value?.[0]?.hitsContainers?.[0]?.hits) {
      results.push(...fileSearchResponse.value[0].hitsContainers[0].hits.map((hit: any) => ({
        id: hit.resource.id,
        name: hit.resource.name || 'Untitled',
        webUrl: hit.resource.webUrl,
        lastModifiedDateTime: hit.resource.lastModifiedDateTime,
        size: hit.resource.size || 0,
        type: hit.resource.folder ? 'folder' : 'file'
      })));
    }

    // Search for emails
    try {
      const emailResponse = await graphClient
        .api('/me/messages')
        .filter(`contains(subject,'${query}') or contains(bodyPreview,'${query}')`)
        .select('id,subject,webLink,receivedDateTime,from,bodyPreview')
        .top(25)
        .get();

      if (emailResponse?.value) {
        results.push(...emailResponse.value.map((email: any) => ({
          id: email.id,
          name: email.subject || 'No Subject',
          webUrl: email.webLink,
          lastModifiedDateTime: email.receivedDateTime,
          type: 'email',
          preview: email.bodyPreview,
          from: {
            name: email.from?.emailAddress?.name,
            email: email.from?.emailAddress?.address
          }
        })));
      }
    } catch (emailError) {
      console.error('Error searching emails:', emailError);
    }

    // Search for Teams messages
    try {
      const teams = await graphClient
        .api('/me/joinedTeams')
        .get();

      for (const team of teams.value || []) {
        const channels = await graphClient
          .api(`/teams/${team.id}/channels`)
          .get();

        for (const channel of channels.value || []) {
          // Get all recent messages without filtering first
          const messagesResponse = await graphClient
            .api(`/teams/${team.id}/channels/${channel.id}/messages`)
            .top(50)  // Increased to get more messages
            .get();

          if (messagesResponse?.value) {
            const channelMessages = messagesResponse.value
              .filter((msg: any) => {
                if (msg.messageType !== 'message') return false;
                
                // Get the message content and clean it
                const messageContent = msg.body?.content || '';
                const cleanContent = messageContent
                  .replace(/<[^>]*>/g, '')  // Remove HTML tags
                  .replace(/&nbsp;/g, ' ')  // Convert HTML spaces
                  .replace(/\s+/g, ' ')     // Normalize whitespace
                  .trim()
                  .toLowerCase();           // Case-insensitive comparison
                
                // Check if the cleaned content includes the query (case-insensitive)
                return cleanContent.includes(query.toLowerCase());
              })
              .map((msg: any) => {
                const messageContent = msg.body?.content || '';
                const cleanContent = messageContent
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();

                return {
                  id: msg.id,
                  name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
                  webUrl: msg.webUrl,
                  lastModifiedDateTime: msg.lastModifiedDateTime || msg.createdDateTime,
                  type: 'channel',
                  preview: cleanContent,
                  from: {
                    name: msg.from?.user?.displayName || 'Unknown'
                  },
                  location: {
                    team: team.displayName || 'Unknown Team',
                    channel: channel.displayName || 'Unknown Channel'
                  }
                };
              });

            results.push(...channelMessages);
          }
        }
      }
    } catch (teamsError) {
      console.error('Error searching Teams messages:', teamsError);
    }

    // Search for planner tasks
    try {
      const plannerResponse = await graphClient
        .api('/me/planner/tasks')
        .filter(`contains(title,'${query}')`)
        .select('id,title,createdDateTime,planId,bucketId')
        .top(25)
        .get();

      if (plannerResponse?.value) {
        results.push(...plannerResponse.value.map((task: any) => ({
          id: task.id,
          name: task.title || 'Untitled Task',
          webUrl: `https://tasks.office.com/searchable.no/Home/Task/${task.id}`,
          lastModifiedDateTime: task.createdDateTime,
          type: 'planner'
        })));
      }
    } catch (plannerError) {
      console.error('Error searching planner tasks:', plannerError);
    }

    // Sort all results by lastModifiedDateTime
    return results.sort((a, b) => 
      new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
    );

  } catch (error) {
    console.error('Error searching Microsoft content:', error);
    throw error;
  }
} 