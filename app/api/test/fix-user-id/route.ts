import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { index as pineconeIndex } from '@/lib/pinecone'

export async function GET() {
  try {
    const email = 'arne@searchable.no'
    const authUserId = 'b54dc0a3-3ef5-44ca-89e9-b7c18b00fa8e'
    
    console.log('\nStarting user ID fix for email:', email)

    // Get the user from the database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, connections(*)')
      .ilike('email', email)
      .single()

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 404 }
      )
    }

    console.log('\nFound user:', JSON.stringify(user, null, 2))

    // Update Pinecone vectors to use the auth user ID
    console.log('\nUpdating Pinecone vectors...')
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
            values: match.values || [],
            metadata: {
              ...match.metadata,
              userId: authUserId
            }
          }])
        }
      }
    } else {
      console.log('No vectors found for this user')
    }

    // Create new user record with auth ID
    console.log('\nCreating new user record...')
    const { error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUserId,
        email: email,
        created_at: user.created_at
      })

    if (createError) {
      console.error('Error creating user:', createError)
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Update connections to use the auth user ID
    if (user.connections?.length) {
      console.log(`\nUpdating ${user.connections.length} connections...`)
      for (const conn of user.connections) {
        const { error: updateError } = await supabaseAdmin
          .from('connections')
          .update({ user_id: authUserId })
          .eq('id', conn.id)

        if (updateError) {
          console.error('Error updating connection:', updateError)
        }
      }
    }

    // Delete the old user record
    console.log('\nDeleting old user record...')
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteError) {
      console.error('Error deleting old user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete old user' },
        { status: 500 }
      )
    }

    console.log('\nUser ID fix completed successfully')
    return NextResponse.json({
      success: true,
      oldId: user.id,
      newId: authUserId
    })
  } catch (error) {
    console.error('Error fixing user ID:', error)
    return NextResponse.json(
      { error: 'Failed to fix user ID', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 