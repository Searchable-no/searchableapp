import { Client } from '@microsoft/microsoft-graph-client'
import { getValidAccessToken } from './server-actions'

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
  isRead?: boolean
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
  parentReference?: {
    driveId?: string
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
  dueDateTime: string | null
  createdDateTime: string
  assignedUserIds: string[]
  planId: string
  planTitle?: string
  bucketId: string
  bucketName?: string
  percentComplete: number
  type: 'planner'
  webUrl?: string
  description?: string
  priority?: number
  score?: number
  name?: string
  lastModifiedDateTime?: string
  createdBy?: {
    user?: {
      displayName?: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      displayName?: string;
    };
  };
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
      .api('/me/mailFolders/inbox/messages')
      .select('id,subject,from,receivedDateTime,bodyPreview,webLink,isRead')
      .filter('isDraft eq false')
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

interface ChatMessage {
  lastMessagePreview?: {
    id: string
    body: {
      content: string
    }
    from: any
  }
}

interface MessageResponse {
  messageType?: string
  body?: {
    content: string
  }
  from?: {
    user?: {
      displayName: string
    }
  }
  id: string
  createdDateTime: string
  webUrl?: string
}

export async function getRecentTeamsChannelMessages(userId: string) {
  console.log('Starting to fetch Teams channel messages...')
  
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    // Get all teams the user is part of
    const teamsResponse = await graphClient
      .api('/me/joinedTeams')
      .get()

    if (!teamsResponse?.value) {
      console.log('No teams found')
      return []
    }

    const messages: TeamsChannelMessage[] = []

    // For each team, get the channels and their messages
    for (const team of teamsResponse.value) {
      const channelsResponse = await graphClient
        .api(`/teams/${team.id}/channels`)
        .get()

      if (channelsResponse?.value) {
        for (const channel of channelsResponse.value) {
          try {
            const messagesResponse = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages`)
              .top(5)
              .get()

            if (messagesResponse?.value) {
              const channelMessages = messagesResponse.value
                .filter((msg: MessageResponse) => msg.messageType === 'message')
                .map((msg: MessageResponse) => ({
                  id: msg.id,
                  content: msg.body?.content,
                  from: {
                    user: {
                      displayName: msg.from?.user?.displayName || 'Unknown User'
                    }
                  },
                  createdDateTime: msg.createdDateTime,
                  channelIdentity: {
                    channelId: channel.id,
                    teamId: team.id
                  },
                  teamName: team.displayName,
                  channelName: channel.displayName,
                  webUrl: msg.webUrl,
                  isRead: true // Default all messages to read since we can't reliably get read status
                }))

              messages.push(...channelMessages)
            }
          } catch (error) {
            console.error(`Error fetching messages for channel ${channel.displayName}:`, error)
            continue
          }
        }
      }
    }

    // Sort all messages by date and return the most recent
    return messages
      .sort((a: TeamsChannelMessage, b: TeamsChannelMessage) => 
        new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
      )
      .slice(0, 10)

  } catch (error) {
    console.error('Error in getRecentTeamsChannelMessages:', error)
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
    
    // Get date range for today and the next 5 days
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 23, 59, 59, 999)
    
    console.log('Fetching calendar events between:', {
      start: startOfToday.toISOString(),
      end: endDate.toISOString()
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
        name: c.name,
        isDefault: c.isDefaultCalendar
      }))
    })

    // Find the primary calendar (either default calendar or first available)
    const primaryCalendar = calendarsResponse?.value?.find((c: any) => c.isDefaultCalendar) || calendarsResponse?.value?.[0]
    if (!primaryCalendar) {
      console.error('No calendars found')
      return []
    }

    // Get events only from the primary calendar
    const response = await graphClient
      .api(`/me/calendars/${primaryCalendar.id}/events`)
      .select('id,subject,start,end,location,webLink,organizer,isOnlineMeeting')
      .filter(`start/dateTime ge '${now.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`)
      .orderby('start/dateTime')
      .top(25)
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
        return (b.priority || 0) - (a.priority || 0)
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
  console.log(`Starting to fetch comments for task ID: ${taskId}`);
  
  try {
    const accessToken = await getValidAccessToken(userId);
    
    if (!accessToken) {
      console.error('Failed to get valid access token for fetching comments');
      return [];
    }
    
    const graphClient = await getGraphClient(accessToken);
    
    console.log(`Fetching task details to get comments for task ID: ${taskId}`);
    
    try {
      const response = await graphClient
        .api(`/planner/tasks/${taskId}/details`)
        .get();

      if (!response) {
        console.warn(`No details found for task ${taskId}`);
        return [];
      }
      
      console.log(`Got task details with ${Object.keys(response.comments || {}).length} comments`);

      if (!response?.comments || Object.keys(response.comments).length === 0) {
        console.log(`No comments found for task ${taskId}`);
        return [];
      }

      // Convert the comments object to our PlannerTaskComment format
      return Object.entries(response.comments)
        .map(([id, comment]: [string, any]) => ({
          id,
          content: comment.message || '',
          createdDateTime: comment.createdDateTime || new Date().toISOString(),
          user: {
            displayName: comment.user?.displayName || 'Unknown User',
            id: comment.user?.id || 'unknown'
          }
        }))
        .sort((a, b) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime());
    } catch (detailsError: any) {
      console.error('Error fetching task details for comments:', {
        message: detailsError.message,
        code: detailsError.code,
        statusCode: detailsError.statusCode
      });
      throw detailsError;
    }
  } catch (error: any) {
    console.error('Error in getTaskComments:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined
    });
    return [];
  }
}

export async function addTaskComment(userId: string, taskId: string, content: string): Promise<boolean> {
  console.log(`Adding comment to task ${taskId}`);
  
  if (!content.trim()) {
    console.error('Cannot add empty comment');
    return false;
  }
  
  try {
    const accessToken = await getValidAccessToken(userId);
    
    if (!accessToken) {
      console.error('Failed to get valid access token for adding comment');
      return false;
    }
    
    const graphClient = await getGraphClient(accessToken);
    
    // First get the current task details to get the etag
    console.log(`Fetching task details to get etag for task ${taskId}`);
    let currentDetails: { '@odata.etag'?: string; comments?: Record<string, any> } = {};
    try {
      currentDetails = await graphClient
        .api(`/planner/tasks/${taskId}/details`)
        .get();
      
      console.log(`Got task details with etag: ${currentDetails['@odata.etag']}`);
    } catch (detailsError: any) {
      // If details don't exist yet, we'll create them
      if (detailsError.statusCode === 404) {
        console.log('Task details do not exist yet, will create with comment');
        try {
          // Create details with the comment
          await graphClient
            .api(`/planner/tasks/${taskId}/details`)
            .post({
              description: '',
              comments: {
                [new Date().getTime().toString()]: {
                  message: content,
                  createdDateTime: new Date().toISOString()
                }
              }
            });
          
          console.log('Successfully created task details with comment');
          return true;
        } catch (createError: any) {
          console.error('Error creating task details with comment:', {
            message: createError.message,
            code: createError.code,
            statusCode: createError.statusCode
          });
          return false;
        }
      }
      
      console.error('Error fetching task details for adding comment:', {
        message: detailsError.message,
        code: detailsError.code,
        statusCode: detailsError.statusCode
      });
      return false;
    }
    
    if (!currentDetails['@odata.etag']) {
      console.error('No etag found in task details, cannot update');
      return false;
    }
    
    // Create a new comment
    const commentId = new Date().getTime().toString();
    const comment = {
      message: content,
      createdDateTime: new Date().toISOString()
    };
    
    // Add the new comment to existing comments
    const existingComments: Record<string, any> = currentDetails.comments || {};
    const updatedComments = {
      ...existingComments,
      [commentId]: comment
    };
    
    try {
      console.log(`Updating task details with new comment (ID: ${commentId})`);
      await graphClient
        .api(`/planner/tasks/${taskId}/details`)
        .header('If-Match', currentDetails['@odata.etag'])
        .patch({
          comments: updatedComments
        });
      
      console.log('Comment added successfully');
      return true;
    } catch (updateError: any) {
      if (updateError.statusCode === 412) {
        console.error('Precondition failed (412): Task details modified by another process');
        // Could implement retry logic here
      }
      
      console.error('Error updating task details with comment:', {
        message: updateError.message,
        code: updateError.code,
        statusCode: updateError.statusCode,
        body: updateError.body ? JSON.stringify(updateError.body, null, 2) : undefined
      });
      return false;
    }
  } catch (error: any) {
    console.error('Error in addTaskComment:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined
    });
    return false;
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
  score?: number;
  from?: {
    name?: string;
    email?: string;
  };
  location?: {
    team?: string;
    channel?: string;
  };
  createdBy?: {
    user: {
      displayName: string;
    }
  };
  lastModifiedBy?: {
    user: {
      displayName: string;
    }
  };
}

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export async function getSharePointSites(userId: string): Promise<SharePointSite[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
    
    const sitesResponse = await graphClient
      .api('/sites?search=*')
      .select('id,name,displayName,webUrl')
      .get();

    return sitesResponse.value.map((site: any) => ({
      id: site.id,
      name: site.name,
      displayName: site.displayName || site.name,
      webUrl: site.webUrl
    }));
  } catch (error) {
    console.error('Error fetching SharePoint sites:', error);
    throw error;
  }
}

export async function searchSharePointFiles(
  userId: string, 
  query: string,
  siteId?: string,
  contentTypes?: ('file' | 'folder' | 'email' | 'chat' | 'channel' | 'planner')[],
  fileExtensions?: string[]
): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
    const results: SearchResult[] = [];

    // Build search query string with file extension filters if provided
    let searchQuery = query.trim() ? `"${query}"` : "";
    
    // Add filename queries if there's a query
    if (query.trim()) {
      searchQuery += ` OR filename:"${query}" OR filename~:"${query}"`;
    }
    
    // Add fileextension filters if specified
    if (fileExtensions && fileExtensions.length > 0) {
      // Create extension filter (e.g., filetype:docx OR filetype:pdf)
      const extensionFilters = fileExtensions.map(ext => `filetype:${ext}`).join(' OR ');
      
      // If there's a query, combine with extensions
      if (query.trim()) {
        searchQuery = `(${searchQuery}) AND (${extensionFilters})`;
      } else {
        // If no query and we're just filtering by file type, use a broader search
        // This will find all files of the specified type(s)
        searchQuery = extensionFilters;
      }
    } else if (!query.trim()) {
      // If no query and no file extensions, use a wildcard to find all items
      searchQuery = "*";
    }
    
    console.log("Search query string:", searchQuery);

    // Search for files and folders
    const fileSearchResponse = await graphClient
      .api('/search/query')
      .post({
        requests: [{
          entityTypes: ['driveItem'],
          query: {
            queryString: searchQuery,
          },
          fields: [
            'id',
            'name',
            'webUrl',
            'lastModifiedDateTime',
            'size',
            'createdBy',
            'lastModifiedBy',
            'parentReference',
            'folder'
          ],
          from: 0,
          size: 50, // Increased from 25 to get more results
          queryAlterationOptions: {
            enableSpellCheck: true,
            enableModification: true
          },
          ...(siteId && {
            queryContext: {
              siteId: siteId
            }
          })
        }]
      });

    // If we have a siteId, also fetch all folders explicitly to ensure we have folder structure
    let folderResults: any[] = [];
    if (siteId && (contentTypes?.includes('folder') || !contentTypes)) {
      try {
        console.log("Fetching folder structure for site:", siteId);
        // We need to extract the site's drive ID
        const siteResponse = await graphClient
          .api(`/sites/${siteId}`)
          .get();
        
        // Get the default document library for the site
        const driveResponse = await graphClient
          .api(`/sites/${siteId}/drives`)
          .get();
        
        if (driveResponse?.value?.length > 0) {
          const defaultDriveId = driveResponse.value[0].id;
          console.log("Default drive ID for site:", defaultDriveId);
          
          // Get all folders recursively (or at least as many as allowed)
          const foldersResponse = await graphClient
            .api(`/drives/${defaultDriveId}/root/children`)
            .expand('children')
            .get();
          
          console.log(`Found ${foldersResponse?.value?.length || 0} top-level items in drive`);
          
          // Process folders to add them to results
          if (foldersResponse?.value) {
            const folders = foldersResponse.value.filter((item: any) => item.folder);
            
            // Add paths to folders
            folders.forEach((folder: any) => {
              // Extract paths information
              const folderPath = (folder.name || "").trim();
              
              folderResults.push({
                id: folder.id,
                name: folder.name,
                webUrl: folder.webUrl,
                lastModifiedDateTime: folder.lastModifiedDateTime,
                type: 'folder',
                score: 0,
                path: folderPath,
                parentFolderPath: '',
                createdBy: folder.createdBy,
                lastModifiedBy: folder.lastModifiedBy,
              });
              
              // Process subfolders if available
              if (folder.children?.value) {
                const subfolders = folder.children.value.filter((item: any) => item.folder);
                subfolders.forEach((subfolder: any) => {
                  folderResults.push({
                    id: subfolder.id,
                    name: subfolder.name,
                    webUrl: subfolder.webUrl,
                    lastModifiedDateTime: subfolder.lastModifiedDateTime,
                    type: 'folder',
                    score: 0,
                    path: `${folderPath}/${subfolder.name}`,
                    parentFolderPath: folderPath,
                    createdBy: subfolder.createdBy,
                    lastModifiedBy: subfolder.lastModifiedBy,
                  });
                });
              }
            });
            
            console.log(`Processed ${folderResults.length} folders with paths`);
          }
        }
      } catch (folderError) {
        console.error("Error fetching folder structure:", folderError);
      }
    }
    
    // Process search results
    if (fileSearchResponse.value?.[0]?.hitsContainers?.[0]?.hits) {
      const fileResults = fileSearchResponse.value[0].hitsContainers[0].hits
        .map((hit: any) => {
          const resource = hit.resource || {};
          const hitScore = hit.hitScore || 0;
          
          // Log raw results for debugging
          console.log("Raw search result:", {
            name: resource.name,
            id: resource.id,
            hitScore,
            url: resource.webUrl,
            resourceType: resource.folder ? 'folder' : 'file'
          });
          
          // Extract path information
          let path = '';
          if (resource.webUrl) {
            try {
              const url = new URL(resource.webUrl);
              const pathParts = url.pathname.split('/');
              
              // Skip the first parts (domain, sites, siteName)
              const relevantParts = pathParts.slice(3, -1); // Skip the file name at the end
              
              if (relevantParts.length > 0) {
                // Build the path from relevant parts
                path = relevantParts.map(part => decodeURIComponent(part)).join('/');
              }
            } catch (e) {
              console.log("Error parsing URL for path:", e);
            }
          }
          
          // Use Microsoft's built-in relevance scoring (hitScore) directly
          return {
            id: resource.id,
            name: resource.name || 'Untitled',
            webUrl: resource.webUrl,
            lastModifiedDateTime: resource.lastModifiedDateTime,
            size: resource.size || 0,
            type: resource.folder ? 'folder' as const : 'file' as const,
            score: hitScore,
            path: path, // Add the extracted path
            createdBy: {
              user: {
                displayName: resource.createdBy?.user?.displayName || resource.createdBy?.email || 'Unknown'
              }
            },
            lastModifiedBy: {
              user: {
                displayName: resource.lastModifiedBy?.user?.displayName || resource.lastModifiedBy?.email || 'Unknown'
              }
            },
            siteId: resource.parentReference?.siteId
          };
        });

      // If siteId is provided, only include results from that site
      results.push(...(siteId 
        ? fileResults.filter((result: { siteId?: string }) => result.siteId === siteId)
        : fileResults));
    }
    
    // Add folder results to the main results
    results.push(...folderResults);
    
    // If we have a siteId and found no results, add some dummy folders for testing
    if (siteId && results.length === 0) {
      console.log("No results found, adding dummy folders for testing");
      
      // Add a few dummy folders to test the UI
      results.push({
        id: "dummy-folder-1",
        name: "Dokumenter",
        webUrl: "#",
        lastModifiedDateTime: new Date().toISOString(),
        type: "folder",
        score: 0,
        path: "Dokumenter",
        createdBy: { user: { displayName: "System" } },
        lastModifiedBy: { user: { displayName: "System" } }
      });
      
      results.push({
        id: "dummy-folder-2",
        name: "Rapporter",
        webUrl: "#",
        lastModifiedDateTime: new Date().toISOString(),
        type: "folder",
        score: 0,
        path: "Dokumenter/Rapporter",
        createdBy: { user: { displayName: "System" } },
        lastModifiedBy: { user: { displayName: "System" } }
      });
      
      results.push({
        id: "dummy-folder-3",
        name: "Presentasjoner",
        webUrl: "#",
        lastModifiedDateTime: new Date().toISOString(),
        type: "folder",
        score: 0,
        path: "Presentasjoner",
        createdBy: { user: { displayName: "System" } },
        lastModifiedBy: { user: { displayName: "System" } }
      });
    }
    
    console.log(`Final search results count: ${results.length} items`);
    
    // Only search for other content types if no content type filter is specified or if they're included in the filter
    if (!contentTypes || contentTypes.includes('email')) {
      try {
        const emailResponse = await graphClient
          .api('/me/messages')
          .filter(`contains(subject,'${query}')`)
          .select('id,subject,webLink,receivedDateTime,from,bodyPreview')
          .top(25)
          .get();

        if (emailResponse?.value) {
          const emailResults = emailResponse.value
            .filter((email: any) => 
              !query || 
              email.bodyPreview?.toLowerCase().includes(query.toLowerCase())
            )
            .map((email: any) => ({
              id: email.id,
              name: email.subject || 'No Subject',
              webUrl: email.webLink,
              lastModifiedDateTime: email.receivedDateTime,
              type: 'email' as const,
              preview: email.bodyPreview,
              from: {
                name: email.from?.emailAddress?.name,
                email: email.from?.emailAddress?.address
              }
            }));
          results.push(...emailResults);
        }
      } catch (emailError) {
        console.error('Error searching emails:', emailError);
      }
    }

    // Search for Teams messages if included in content types
    if (!contentTypes || contentTypes.includes('chat') || contentTypes.includes('channel')) {
      try {
        const teams = await graphClient
          .api('/me/joinedTeams')
          .get();

        for (const team of teams.value || []) {
          const channels = await graphClient
            .api(`/teams/${team.id}/channels`)
            .get();

          for (const channel of channels.value || []) {
            const messagesResponse = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages`)
              .top(50)
              .get();

            if (messagesResponse?.value) {
              const channelMessages = messagesResponse.value
                .filter((msg: any) => {
                  if (msg.messageType !== 'message') return false;
                  
                  const messageContent = msg.body?.content || '';
                  const cleanContent = messageContent
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
                  
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
                    type: 'channel' as const,
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
    }

    // Search for planner tasks if included in content types
    if (!contentTypes || contentTypes.includes('planner')) {
      try {
        const plannerResponse = await graphClient
          .api('/me/planner/tasks')
          .filter(`contains(title,'${query}')`)
          .select('id,title,createdDateTime,planId,bucketId,createdBy,details')
          .top(25)
          .get();

        if (plannerResponse?.value) {
          const tasksWithDetails = await Promise.all(
            plannerResponse.value.map(async (task: any) => {
              try {
                const details = await graphClient
                  .api(`/planner/tasks/${task.id}/details`)
                  .get();
                return { ...task, details };
              } catch (error) {
                console.error(`Error fetching details for task ${task.id}:`, error);
                return task;
              }
            })
          );

          results.push(...tasksWithDetails.map((task: any) => {
            const lastModifier = task.details?.lastModifiedBy?.user || task.createdBy;
            
            return {
              id: task.id,
              name: task.title || 'Untitled Task',
              webUrl: `https://tasks.office.com/searchable.no/Home/Task/${task.id}`,
              lastModifiedDateTime: task.details?.lastModifiedDateTime || task.createdDateTime,
              type: 'planner' as const,
              createdBy: {
                user: {
                  displayName: task.createdBy?.user?.displayName || 'Unknown',
                  email: task.createdBy?.user?.email || task.createdBy?.user?.id || 'Unknown'
                }
              },
              lastModifiedBy: {
                user: {
                  displayName: lastModifier?.displayName || 'Unknown',
                  email: lastModifier?.email || lastModifier?.id || 'Unknown'
                }
              }
            };
          }));
        }
      } catch (plannerError) {
        console.error('Error searching planner tasks:', plannerError);
      }
    }

    // Sort all results by score first, then by lastModifiedDateTime
    return results.sort((a, b) => {
      // First compare by score if available
      if (a.score !== undefined && b.score !== undefined) {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
      }
      
      // Then by lastModifiedDateTime as a tiebreaker
      return new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime();
    });

  } catch (error) {
    console.error('Error searching Microsoft content:', error);
    throw error;
  }
}

export async function markEmailAsRead(userId: string, emailId: string): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    // Use PATCH instead of UPDATE and specify the content-type header
    await graphClient
      .api(`/me/messages/${emailId}`)
      .header('Content-Type', 'application/json')
      .patch({
        isRead: true
      })

    return true
  } catch (error: any) {
    console.error('Error marking email as read:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body
    })
    // Return false but don't throw, so the UI can still update
    return false
  }
}

export async function markTeamsChatMessageAsRead(userId: string, chatId: string, messageId: string): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    await graphClient
      .api(`/me/chats/${chatId}/messages/${messageId}/setReadStatus`)
      .post({
        isRead: true
      })

    return true
  } catch (error: any) {
    console.error('Error marking Teams chat message as read:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body
    })
    return false
  }
}

export async function markTeamsChannelMessageAsRead(
  userId: string, 
  teamId: string, 
  channelId: string, 
  messageId: string
): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const graphClient = await getGraphClient(accessToken)

    await graphClient
      .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/setReadStatus`)
      .post({
        isRead: true
      })

    return true
  } catch (error: any) {
    console.error('Error marking Teams channel message as read:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body
    })
    return false
  }
}

export async function searchPlannerTasks(
  userId: string,
  query: string
): Promise<PlannerTask[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
    
    // First, let's get all the plans the user has access to
    // We'll need to get groups the user is a member of
    const groupsResponse = await graphClient
      .api('/me/memberOf')
      .select('id,displayName')
      .get();
      
    const groups = groupsResponse.value.filter((group: any) => 
      group['@odata.type'] === '#microsoft.graph.group'
    );
    
    const results: PlannerTask[] = [];
    
    // For each group, get the associated plans and tasks
    for (const group of groups) {
      try {
        // Get plans for this group
        const plansResponse = await graphClient
          .api(`/groups/${group.id}/planner/plans`)
          .select('id,title')
          .get();
        
        // For each plan, get tasks and filter by query
        for (const plan of plansResponse.value) {
          try {
            // Get tasks for this plan
            const tasksResponse = await graphClient
              .api(`/planner/plans/${plan.id}/tasks`)
              .get();
            
            // Get buckets for this plan for better task context
            const bucketsResponse = await graphClient
              .api(`/planner/plans/${plan.id}/buckets`)
              .get();
            
            // Create a map of bucket IDs to names
            const bucketMap: { [key: string]: string } = {};
            for (const bucket of bucketsResponse.value) {
              bucketMap[bucket.id] = bucket.name;
            }
            
            // Filter and map tasks
            const filteredTasks = tasksResponse.value
              // Only include tasks that match the query
              .filter((task: any) => {
                const title = task.title?.toLowerCase() || '';
                const description = task.description?.toLowerCase() || '';
                const query_lower = query.toLowerCase();
                
                return title.includes(query_lower) || description.includes(query_lower);
              })
              // Map to our PlannerTask interface
              .map((task: any) => ({
                id: task.id,
                title: task.title,
                dueDateTime: task.dueDateTime,
                createdDateTime: task.createdDateTime,
                assignedUserIds: task.assignments ? Object.keys(task.assignments) : [],
                planId: plan.id,
                planTitle: plan.title,
                bucketId: task.bucketId,
                bucketName: bucketMap[task.bucketId] || 'Unknown',
                type: 'planner' as const,
                webUrl: `https://tasks.office.com/Home/Task/${task.id}`
              }));
            
            results.push(...filteredTasks);
          } catch (error) {
            // Continue with other plans if one has an issue
            console.error(`Error getting tasks for plan ${plan.id}:`, error);
          }
        }
      } catch (error) {
        // Continue with other groups if one has an issue
        console.error(`Error getting planner plans for group ${group.id}:`, error);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error searching Planner tasks:', error);
    throw error;
  }
} 