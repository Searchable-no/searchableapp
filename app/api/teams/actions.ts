'use server'

import { getAllTeams, getAllGroups, getTeamsMessageThread, sendTeamsReply, startNewTeamsThread, getTeamMembers } from '@/lib/microsoft-graph'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function getCurrentUserId() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user?.email) {
    console.error('Authentication error:', error)
    throw new Error('Not authenticated')
  }
  
  // Get user ID from database
  const { data: userData, error: userDbError } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .single()

  if (userDbError || !userData) {
    console.error('Database error:', userDbError)
    throw new Error('User not found in database')
  }
  
  return userData.id
}

export async function fetchMessageThread(userId: string, messageId: string) {
  try {
    const currentUserId = await getCurrentUserId()
    if (currentUserId !== userId) {
      throw new Error('Unauthorized')
    }
    return await getTeamsMessageThread(userId, messageId)
  } catch (error) {
    console.error('Error in fetchMessageThread:', error)
    throw error
  }
}

export async function sendMessageReply(userId: string, messageId: string, content: string) {
  try {
    const currentUserId = await getCurrentUserId()
    if (currentUserId !== userId) {
      throw new Error('Unauthorized')
    }
    return await sendTeamsReply(userId, messageId, content)
  } catch (error) {
    console.error('Error in sendMessageReply:', error)
    throw error
  }
}

export async function startNewThread(userId: string, teamId: string, channelId: string, content: string) {
  try {
    const currentUserId = await getCurrentUserId()
    if (currentUserId !== userId) {
      throw new Error('Unauthorized')
    }
    
    if (!teamId || !channelId) {
      throw new Error('Team ID and Channel ID are required')
    }

    return await startNewTeamsThread(userId, teamId, channelId, content)
  } catch (error) {
    console.error('Error in startNewThread:', error)
    throw error
  }
}

export async function getTeams(userId: string) {
  try {
    const currentUserId = await getCurrentUserId()
    
    if (!currentUserId) {
      console.error('No current user ID found')
      throw new Error('Not authenticated')
    }
    
    if (currentUserId !== userId) {
      console.error('User ID mismatch - Current:', currentUserId, 'Requested:', userId)
      throw new Error('Not authenticated')
    }
    
    // Get Microsoft Graph access token and fetch teams
    return await getAllTeams(userId)
  } catch (error) {
    console.error('Error in getTeams:', error)
    throw error
  }
}

export async function getGroups(userId: string) {
  try {
    const currentUserId = await getCurrentUserId()
    
    if (!currentUserId) {
      console.error('No current user ID found')
      throw new Error('Not authenticated')
    }
    
    if (currentUserId !== userId) {
      console.error('User ID mismatch - Current:', currentUserId, 'Requested:', userId)
      throw new Error('Not authenticated')
    }
    
    // Get Microsoft Graph access token and fetch groups
    return await getAllGroups(userId)
  } catch (error) {
    console.error('Error in getGroups:', error)
    throw error
  }
}

export async function getMembers(userId: string, teamId: string) {
  try {
    const currentUserId = await getCurrentUserId()
    
    if (!currentUserId) {
      console.error('No current user ID found')
      throw new Error('Not authenticated')
    }
    
    if (currentUserId !== userId) {
      console.error('User ID mismatch - Current:', currentUserId, 'Requested:', userId)
      throw new Error('Not authenticated')
    }
    
    // Get Microsoft Graph access token and fetch team members
    return await getTeamMembers(userId, teamId)
  } catch (error) {
    console.error('Error in getMembers:', error)
    throw error
  }
} 