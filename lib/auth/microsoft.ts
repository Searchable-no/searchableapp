import { PublicClientApplication, type AuthenticationResult } from '@azure/msal-browser'

const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
}

const scopes = [
  'User.Read',                // For basic user profile
  'Mail.Read',                // For Outlook emails
  'Chat.Read',                // For Teams chat messages
  'Chat.ReadWrite',           // For Teams chat read/write
  'ChatMessage.Read',         // For reading chat messages
  'ChatMessage.Send',         // For sending chat messages
  'Team.ReadBasic.All',       // For Teams membership
  'TeamMember.Read.All',      // For reading team members
  'TeamMember.ReadWrite.All', // For adding/removing team members
  'Group.ReadWrite.All',      // For managing groups/teams
  'GroupMember.ReadWrite.All', // For managing group/team members
  'Channel.ReadBasic.All',    // For Teams channel access
  'ChannelMessage.Read.All',  // For Teams channel messages
  'ChannelMessage.Send',      // For sending Teams channel messages
  'Files.Read.All',           // For both SharePoint and OneDrive files
  'Sites.Read.All',           // For SharePoint site content
  'Calendars.Read',           // For calendar events
  'Tasks.ReadWrite',          // For reading and updating Planner tasks
  'Group.Read.All',           // For accessing Planner plans
  'offline_access',           // For refresh tokens
  'openid',                   // For authentication
  'profile',                  // For user profile info
  'email'                     // For user email
]

export const msalInstance = new PublicClientApplication(msalConfig)

export async function signIn() {
  try {
    const response = await msalInstance.loginPopup({
      scopes,
      prompt: 'select_account',
    })
    
    if (response) {
      await setToken(response)
    }
    
    return response
  } catch (error) {
    console.error('Error during sign in:', error)
    throw error
  }
}

export async function signOut() {
  try {
    await msalInstance.logoutPopup()
    document.cookie = 'ms_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
  } catch (error) {
    console.error('Error during sign out:', error)
    throw error
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const account = msalInstance.getAllAccounts()[0]
    if (!account) {
      return null
    }

    const response = await msalInstance.acquireTokenSilent({
      scopes,
      account,
    })

    return response.accessToken
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

async function setToken(response: AuthenticationResult) {
  const token = response.accessToken
  // Set token in cookie for server-side access
  document.cookie = `ms_access_token=${token}; path=/; max-age=3600; SameSite=Lax`
  
  // Sync token with server
  try {
    const res = await fetch('/api/auth/microsoft/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: token,
        expires_at: new Date(response.expiresOn || Date.now() + 3600 * 1000).toISOString(),
      }),
    })
    
    if (!res.ok) {
      throw new Error('Failed to sync token with server')
    }
  } catch (error) {
    console.error('Error syncing token:', error)
    throw error
  }
} 