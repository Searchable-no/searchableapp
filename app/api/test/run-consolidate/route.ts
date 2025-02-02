import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { index as pineconeIndex } from '@/lib/pinecone'

export async function GET() {
  try {
    const email = 'arne@searchable.no'
    console.log('\nStarting user consolidation for email:', email)

    // Get all users with this email
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*, connections(*)')
      .ilike('email', email)
      .order('created_at', { ascending: true }) // Get oldest first

    if (usersError || !users?.length) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users or no users found' },
        { status: 404 }
      )
    }

    console.log('\nFound users:', JSON.stringify(users, null, 2))

    // Keep the first (oldest) user as the main user
    const mainUser = users[0]
    const otherUsers = users.slice(1)
    
    console.log('\nMain user:', mainUser.id)
    console.log('Users to merge:', otherUsers.map(u => u.id))

    // Update Pinecone vectors to use the main user ID
    for (const user of otherUsers) {
      console.log(`\nProcessing user ${user.id}:`)
      
      // First, fetch all vectors for this user
      const { matches } = await pineconeIndex.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
        filter: { userId: { $eq: user.id } },
        topK: 10000,
        includeMetadata: true,
        includeValues: true
      })

      if (matches?.length) {
        console.log(`Found ${matches.length} vectors to update`)
        
        // Update each vector with the new userId
        for (const match of matches) {
          if (match.metadata) {
            console.log(`Updating vector ${match.id}`)
            await pineconeIndex.upsert([{
              id: match.id,
              values: match.values || [], // If values not included, this will fail
              metadata: {
                ...match.metadata,
                userId: mainUser.id
              }
            }])
          }
        }
      } else {
        console.log('No vectors found for this user')
      }

      // Move connections to main user
      if (user.connections?.length) {
        console.log(`Moving ${user.connections.length} connections to main user`)
        for (const conn of user.connections) {
          const { error: updateError } = await supabaseAdmin
            .from('connections')
            .update({ user_id: mainUser.id })
            .eq('id', conn.id)

          if (updateError) {
            console.error('Error updating connection:', updateError)
          }
        }
      }

      // Delete the other user
      console.log(`Deleting user ${user.id}`)
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user.id)

      if (deleteError) {
        console.error('Error deleting user:', deleteError)
      }
    }

    console.log('\nConsolidation completed successfully')
    return NextResponse.json({
      success: true,
      mainUserId: mainUser.id,
      mergedUsers: otherUsers.map(u => u.id)
    })
  } catch (error) {
    console.error('Error in consolidation:', error)
    return NextResponse.json(
      { error: 'Failed to consolidate users', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 