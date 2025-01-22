import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface DocumentResult {
  title: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  console.log('Autocomplete API called with query:', query);

  if (!query) {
    console.log('No query provided, returning empty suggestions');
    return NextResponse.json({ suggestions: [] })
  }

  try {
    // Get documents that match the query
    const results = await prisma.indexedContent.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        title: true,
      },
      take: 5,
      orderBy: {
        lastModified: 'desc'
      }
    })

    console.log('Database query results:', results);

    // Extract unique suggestions from titles
    const suggestions = Array.from(new Set<string>(
      results.map((result: DocumentResult) => result.title)
        .filter((title: string) => title.toLowerCase().includes(query.toLowerCase()))
    ))

    console.log('Final suggestions:', suggestions);

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) })
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
} 