import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { indexMicrosoftContent } from '@/lib/microsoft'

export async function POST(request: NextRequest) {
  console.log('Reindex endpoint hit')
  try {
    const userEmail = 'Arne@searchable.no' // This should be replaced with actual auth later
    console.log('Looking for user with email:', userEmail)

    const user = await prisma.user.findFirst({
      where: {
        email: {
          mode: 'insensitive',
          equals: userEmail
        }
      }
    })

    console.log('User lookup result:', user)

    if (!user) {
      console.log('User not found')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Start content indexing
    console.log('Starting content indexing for user:', user.id)
    try {
      const indexingResult = await indexMicrosoftContent(user.id)
      console.log('Indexing completed successfully:', indexingResult)

      return NextResponse.json({
        success: true,
        indexed: true,
        ...indexingResult
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