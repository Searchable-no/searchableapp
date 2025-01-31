import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmbedding, normalizeNorwegianText } from '@/lib/embeddings'
import { search } from '@/lib/pinecone'

interface SearchResult {
  id: string
  title: string
  content?: string
  url?: string | null
  lastModified: Date
  type: 'email' | 'document'
  source: 'google' | 'microsoft'
  similarity?: number
}

interface GroupedResults {
  [key: string]: SearchResult[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const source = searchParams.get('source') || 'all'
  const dateRange = searchParams.get('date') || 'all'

  if (!query) {
    return NextResponse.json(
      { error: 'Search query is required' },
      { status: 400 }
    )
  }

  try {
    const userEmail = 'Arne@searchable.no' // This should be replaced with actual auth later

    const user = await prisma.user.findFirst({
      where: {
        email: {
          mode: 'insensitive',
          equals: userEmail
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Normalize the query for better Norwegian language support
    const normalizedQuery = normalizeNorwegianText(query)
    
    // Get embedding for the normalized query
    const queryEmbedding = await getEmbedding(normalizedQuery)

    // Perform semantic search
    const searchResults = await search({
      vector: queryEmbedding,
      query: normalizedQuery,
      topK: 20,
      filter: {
        userId: user.id,
        ...(source !== 'all' ? { source } : {})
      }
    })

    // Transform Pinecone results to our format
    let results = searchResults.map(result => ({
      id: result.id,
      ...result.metadata,
      similarity: result.score
    })) as SearchResult[]

    // Filter by date if specified
    if (dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (dateRange) {
        case 'recent':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'last-week':
          cutoffDate.setDate(now.getDate() - 14)
          break
        case 'last-month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
      }

      results = results.filter(
        result => new Date(result.lastModified) >= cutoffDate
      )
    }

    // Group results by source and type
    const groupedResults = results.reduce((acc: GroupedResults, result) => {
      const category = `${result.source}-${result.type}`
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(result)
      return acc
    }, {})

    // Format the response with categories
    const formattedResults = {
      totalCount: results.length,
      categories: Object.entries(groupedResults).map(([category, items]) => ({
        category,
        source: category.split('-')[0],
        type: category.split('-')[1],
        count: items.length,
        items: items.map(item => ({
          ...item,
          similarity: item.similarity ? Math.round(item.similarity * 100) / 100 : undefined
        }))
      })),
      query,
      dateRange
    }

    return NextResponse.json(formattedResults)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
} 