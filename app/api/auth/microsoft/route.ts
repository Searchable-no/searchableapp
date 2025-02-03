import { NextResponse } from 'next/server'

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

// Use common endpoint for multi-tenant access
const MICROSOFT_OAUTH_URL = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize'
const SCOPE = [
  'Files.Read.All',           // For both SharePoint and OneDrive files
  'Sites.Read.All',           // For SharePoint site content
  'Mail.Read',                // For Outlook emails
  'User.Read',                // For basic user profile
  'Channel.ReadBasic.All',    // For Teams channel access
  'ChannelMessage.Read.All',  // For Teams channel messages
  'ChannelMessage.Send',      // For sending Teams channel messages
  'Chat.Read',                // For Teams chat messages
  'Chat.ReadWrite',           // For Teams chat read/write
  'ChatMessage.Read',         // For reading chat messages
  'ChatMessage.Send',         // For sending chat messages
  'Team.ReadBasic.All',       // For Teams membership
  'TeamMember.Read.All',      // For reading team members
  'TeamMember.ReadWrite.All', // For adding/removing team members
  'Group.ReadWrite.All',      // For managing groups/teams
  'GroupMember.ReadWrite.All', // For managing group/team members
  'Calendars.Read',           // For calendar events
  'Tasks.ReadWrite',          // For reading and updating Planner tasks
  'Group.Read.All',           // For accessing Planner plans
  'offline_access',           // For refresh tokens
  'openid',                   // For authentication
  'profile',                  // For user profile info
  'email'                     // For user email
].join(' ')

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 500 }
    )
  }

  if (!MICROSOFT_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Microsoft OAuth credentials not configured' },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    response_mode: 'query',
    prompt: 'consent', // Always show consent dialog
  })

  return NextResponse.redirect(`${MICROSOFT_OAUTH_URL}?${params.toString()}`)
} 