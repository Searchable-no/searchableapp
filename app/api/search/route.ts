import { NextRequest, NextResponse } from 'next/server'
import { searchMicrosoft } from '@/lib/microsoft'
import { searchGoogle } from '@/lib/google'
import { prisma } from '@/lib/prisma'

interface SearchResult {
  id: string
  title: string
  content?: string
  url?: string
  lastModified: string
  type: 'email' | 'document'
  source: 'google' | 'microsoft'
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
    // Get the user's email from the sidebar
    const userEmail = 'Arne@searchable.no' // This should be replaced with actual auth later

    // Get the user from the database using case-insensitive search
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

    const results: SearchResult[] = []

    if (source === 'all' || source === 'microsoft') {
      try {
        const microsoftResults = await searchMicrosoft(user.id, query)
        results.push(...(microsoftResults as SearchResult[]))
      } catch (error) {
        console.error('Microsoft search error:', error)
        // Continue with other sources even if Microsoft search fails
      }
    }

    if (source === 'all' || source === 'google') {
      try {
        const googleResults = await searchGoogle(user.id, query)
        results.push(...(googleResults as SearchResult[]))
      } catch (error) {
        console.error('Google search error:', error)
        // Continue with other sources even if Google search fails
      }
    }

    // Filter by date if specified
    let filteredResults = results
    if (dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (dateRange) {
        case 'recent':
          cutoffDate.setDate(now.getDate() - 7) // Last 7 days
          break
        case 'last-week':
          cutoffDate.setDate(now.getDate() - 14) // Last 14 days
          break
        case 'last-month':
          cutoffDate.setMonth(now.getMonth() - 1) // Last 30 days
          break
      }

      filteredResults = results.filter(
        result => new Date(result.lastModified) >= cutoffDate
      )
    }

    // Sort by last modified date
    filteredResults.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )

    // Group results by source and type
    const groupedResults = filteredResults.reduce((acc, result) => {
      const category = `${result.source}-${result.type}`
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(result)
      return acc
    }, {} as Record<string, SearchResult[]>)

    // Format the response with categories
    const formattedResults = {
      totalCount: filteredResults.length,
      categories: Object.entries(groupedResults).map(([category, items]) => ({
        category,
        source: category.split('-')[0],
        type: category.split('-')[1],
        count: items.length,
        items
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