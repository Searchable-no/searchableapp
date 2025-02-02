import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding, normalizeNorwegianText } from '@/lib/embeddings'
import { search } from '@/lib/pinecone'

interface PineconeMetadata {
  title: string;
  content: string;
  url: string | null;
  lastModified: string;
  type: "email" | "document";
  source: "microsoft" | "google";
  userId: string;
  sourceId: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  url: string | null;
  lastModified: string;
  type: "email" | "document";
  source: "microsoft" | "google";
  score: number;
}

interface SearchCategory {
  category: string;
  source: string;
  type: string;
  count: number;
  items: SearchResult[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const userId = searchParams.get('userId')
  const source = searchParams.get('source') || 'all'
  const dateRange = searchParams.get('date') || 'all'

  if (!query || !userId) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    )
  }

  try {
    console.log('Search request:', { query, userId, source, dateRange })

    // Get embedding for search query
    const normalizedQuery = normalizeNorwegianText(query)
    console.log('Normalized query:', normalizedQuery)
    const embedding = await getEmbedding(normalizedQuery)
    console.log('Generated embedding of length:', embedding.length)

    // Search Pinecone for similar vectors
    console.log('Searching Pinecone with filter:', { userId: { $eq: userId } })
    const searchResults = await search({
      vector: embedding,
      filter: { userId: { $eq: userId } }
    })
    console.log('Raw Pinecone results:', searchResults)

    // Convert Pinecone results to SearchResult format
    const results = searchResults.map(result => {
      if (!result.metadata) return null
      const metadata = result.metadata as unknown as PineconeMetadata
      return {
        id: result.id,
        title: metadata.title,
        content: metadata.content,
        url: metadata.url,
        lastModified: metadata.lastModified,
        type: metadata.type,
        source: metadata.source,
        score: result.score || 0
      }
    }).filter(Boolean) as SearchResult[]

    // Filter by source if specified
    const filteredResults = source === 'all' 
      ? results 
      : results.filter(result => result.source === source)

    // Filter by date range if specified
    const dateFilteredResults = filterByDateRange(filteredResults, dateRange)

    // Group results by source and type
    const categories = groupResultsByCategory(dateFilteredResults)

    return NextResponse.json({
      totalCount: dateFilteredResults.length,
      categories,
      query,
      dateRange
    })
  } catch (error) {
    console.error('Error in search:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}

function filterByDateRange(results: SearchResult[], dateRange: string): SearchResult[] {
  if (dateRange === 'all') return results

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
    default:
      return results
  }

  return results.filter(result => {
    const lastModified = new Date(result.lastModified)
    return lastModified >= cutoffDate
  })
}

function groupResultsByCategory(results: SearchResult[]): SearchCategory[] {
  const categories: { [key: string]: SearchResult[] } = {}

  results.forEach(result => {
    const key = `${result.source}-${result.type}`
    if (!categories[key]) {
      categories[key] = []
    }
    categories[key].push(result)
  })

  return Object.entries(categories).map(([key, items]) => {
    const [source, type] = key.split('-')
    return {
      category: key,
      source,
      type,
      count: items.length,
      items
    }
  })
} 