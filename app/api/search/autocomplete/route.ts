import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding, normalizeNorwegianText } from '@/lib/embeddings'
import { search } from '@/lib/pinecone'

interface PineconeMetadata {
  title: string;
  url: string | null;
  type: string;
  source: string;
  content: string;
  lastModified: string;
  userId: string;
  sourceId: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.toLowerCase()
  const userId = searchParams.get('userId')

  if (!query || !userId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  try {
    console.log('Autocomplete request:', { query, userId })

    // Get embedding for query
    const normalizedQuery = normalizeNorwegianText(query)
    console.log('Normalized query:', normalizedQuery)
    const embedding = await getEmbedding(normalizedQuery)
    console.log('Generated embedding of length:', embedding.length)

    // Search Pinecone with limit
    console.log('Searching Pinecone with filter:', { userId: { $eq: userId } })
    const searchResults = await search({
      vector: embedding,
      filter: { userId: { $eq: userId } },
      topK: 5
    })
    console.log('Raw Pinecone results:', searchResults)

    // Convert to DocumentResult format
    const results = searchResults.map(result => {
      if (!result.metadata) return null
      const metadata = result.metadata as unknown as PineconeMetadata
      return {
        title: metadata.title,
        url: metadata.url,
        type: metadata.type,
        source: metadata.source
      }
    }).filter(Boolean)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json(
      { error: 'Failed to fetch autocomplete results' },
      { status: 500 }
    )
  }
} 