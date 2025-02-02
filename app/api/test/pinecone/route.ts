import { NextRequest, NextResponse } from 'next/server'
import { indexContent } from '@/lib/embeddings'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    // Test indexing a piece of content
    const testContent = await indexContent(
      userId,
      'test-doc-1',
      'Test Document about Lovdata',
      'This is a test document about Lovdata to verify Pinecone indexing and search is working correctly.',
      null,
      'document',
      'microsoft',
      new Date()
    )

    return NextResponse.json({
      success: true,
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