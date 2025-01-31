import { NextResponse } from 'next/server'
import { indexContent } from '@/lib/embeddings'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Create or get test user
    const testUser = await prisma.user.upsert({
      where: {
        email: 'test@example.com'
      },
      create: {
        email: 'test@example.com',
        name: 'Test User'
      },
      update: {}
    })

    console.log('Test user:', testUser)

    // Test indexing a piece of content
    const testContent = await indexContent(
      testUser.id, // Use the actual user ID
      'test-doc-1',
      'Test Document',
      'This is a test document to verify Pinecone indexing is working correctly.',
      null,
      'document',
      'microsoft',
      new Date()
    )

    return NextResponse.json({
      success: true,
      user: testUser,
      indexed: testContent
    })
  } catch (error) {
    console.error('Test indexing failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 