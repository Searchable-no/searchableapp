import { NextRequest, NextResponse } from 'next/server'
import { deleteAllVectors } from '@/lib/pinecone'
import { indexMicrosoftContent } from '@/lib/microsoft'

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    console.log('Starting reindex process for user:', userId)

    // Delete all existing vectors
    console.log('Deleting existing vectors...')
    await deleteAllVectors()

    // Start reindexing Microsoft content
    console.log('Starting Microsoft content indexing...')
    await indexMicrosoftContent(userId)
    console.log('Completed Microsoft content indexing')

    return NextResponse.json({
      success: true,
      message: 'Successfully deleted all vectors and reindexed Microsoft content'
    })
  } catch (error) {
    console.error('Error during reindexing:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 