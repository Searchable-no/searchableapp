import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { indexMicrosoftContent } from '@/lib/microsoft'

export async function POST() {
  console.log('Reindex endpoint hit')
  try {
    const userEmail = 'Arne@searchable.no' // This should be replaced with actual auth later
    console.log('Looking for user with email:', userEmail)

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', userEmail)
      .single()

    if (userError || !user) {
      console.log('User not found')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Start content indexing
    console.log('Starting content indexing for user:', user.id)
    try {
      await indexMicrosoftContent(user.id)
      console.log('Indexing completed successfully')

      return NextResponse.json({
        success: true,
        indexed: true
      })
    } catch (indexError) {
      console.error('Error during indexing:', indexError)
      return NextResponse.json(
        { 
          error: 'Failed to index content',
          details: indexError instanceof Error ? indexError.message : String(indexError)
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error during reindexing:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reindex content',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 