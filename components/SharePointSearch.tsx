'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, FileText, Folder, Mail, MessageSquare, MessageCircle, Calendar, Filter, SortAsc, Clock, Check, Circle } from 'lucide-react'
import { useUser } from '@/lib/hooks'
import { searchSharePointFiles, type SearchResult } from '@/lib/microsoft-graph'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const dateRanges = {
  'today': 'Today',
  'week': 'Past Week',
  'month': 'Past Month',
  'year': 'Past Year',
  'all': 'All Time'
} as const;

type DateRange = keyof typeof dateRanges;

function formatFileSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function getIconForType(type: SearchResult['type']) {
  switch (type) {
    case 'file':
      return <FileText className="h-5 w-5 text-blue-500" />
    case 'folder':
      return <Folder className="h-5 w-5 text-yellow-500" />
    case 'email':
      return <Mail className="h-5 w-5 text-green-500" />
    case 'chat':
      return <MessageSquare className="h-5 w-5 text-purple-500" />
    case 'channel':
      return <MessageCircle className="h-5 w-5 text-indigo-500" />
    case 'planner':
      return <Calendar className="h-5 w-5 text-red-500" />
    default:
      return <FileText className="h-5 w-5 text-gray-500" />
  }
}

interface ResultGroup {
  title: string;
  type: SearchResult['type'];
  results: SearchResult[];
}

function groupResults(results: SearchResult[]): ResultGroup[] {
  const groups = new Map<string, SearchResult[]>();
  
  results.forEach(result => {
    const type = result.type;
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)?.push(result);
  });

  return Array.from(groups.entries()).map(([type, results]) => ({
    title: type.charAt(0).toUpperCase() + type.slice(1) + 's',
    type: type as SearchResult['type'],
    results
  }));
}

function ResultItem({ result }: { result: SearchResult }) {
  return (
    <a
      href={result.webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
    >
      {getIconForType(result.type)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">{result.name}</h3>
          {result.type === 'channel' && result.location && (
            <span className="text-xs text-gray-500">
              in {result.location.team} &gt; {result.location.channel}
            </span>
          )}
        </div>
        {result.preview && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{result.preview}</p>
        )}
        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
          <span>{new Date(result.lastModifiedDateTime).toLocaleDateString()}</span>
          {result.from && (
            <span>
              From: {result.from.name}
              {result.from.email && ` (${result.from.email})`}
            </span>
          )}
          {result.size !== undefined && (
            <span>{formatFileSize(result.size)}</span>
          )}
          <span className="capitalize">{result.type}</span>
        </div>
      </div>
    </a>
  )
}

export function SharePointSearch() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [databaseUserId, setDatabaseUserId] = useState<string | null>(null)
  
  // New state for filters
  const [selectedTypes, setSelectedTypes] = useState<SearchResult['type'][]>(['file', 'folder', 'email', 'chat', 'channel', 'planner'])
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance')

  // Get the database user ID when auth user is available
  useEffect(() => {
    async function getDatabaseUserId() {
      if (!user?.email) return null
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .single()
        
        if (error) throw error
        setDatabaseUserId(data.id)
      } catch (err) {
        console.error('Error getting database user ID:', err)
        setError('Failed to get user information. Please try signing out and back in.')
      }
    }

    if (user?.email) {
      getDatabaseUserId()
    } else {
      setDatabaseUserId(null)
    }
  }, [user?.email])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    if (!databaseUserId) {
      setError('Please sign in to search files')
      return
    }

    setIsSearching(true)
    setShowResults(true)
    setError(null)

    try {
      const results = await searchSharePointFiles(databaseUserId, searchQuery)
      
      // Filter results based on selected types
      let filteredResults = results.filter(result => selectedTypes.includes(result.type))
      
      // Filter by date range
      if (dateRange !== 'all') {
        const now = new Date()
        const ranges = {
          today: new Date(now.setDate(now.getDate() - 1)),
          week: new Date(now.setDate(now.getDate() - 7)),
          month: new Date(now.setMonth(now.getMonth() - 1)),
          year: new Date(now.setFullYear(now.getFullYear() - 1))
        }
        filteredResults = filteredResults.filter(result => 
          new Date(result.lastModifiedDateTime) > ranges[dateRange as keyof typeof ranges]
        )
      }
      
      // Sort results
      filteredResults.sort((a, b) => {
        if (sortBy === 'date') {
          return new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
        }
        return 0 // Default to API's relevance sorting
      })
      
      setSearchResults(filteredResults)
    } catch (error: any) {
      console.error('Search failed:', error)
      if (error.message === 'Microsoft connection not found') {
        setError(
          'Microsoft account not connected. Please connect your Microsoft account in settings to search files.'
        )
      } else {
        setError('Failed to search files. Please try again.')
      }
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const groupedResults = groupResults(searchResults)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSearch} className="relative mb-4">
        <Input
          type="text"
          placeholder="Search SharePoint files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-32 h-12 text-lg"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" type="button">
                <Filter className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Content Types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['file', 'folder', 'email', 'chat', 'channel', 'planner'] as const).map(type => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => {
                    setSelectedTypes(prev => 
                      prev.includes(type)
                        ? prev.filter(t => t !== type)
                        : [...prev, type]
                    )
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary">
                    {selectedTypes.includes(type) && <Check className="h-3 w-3" />}
                  </div>
                  {getIconForType(type)}
                  <span className="capitalize">{type}s</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" type="button">
                <Clock className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(dateRanges).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setDateRange(key as DateRange)}
                  className="flex items-center gap-2"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border border-primary">
                    {dateRange === key && <Circle className="h-2 w-2 fill-current" />}
                  </div>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            type="submit"
            variant="ghost" 
            size="icon"
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <div className="flex-none p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Search Results</h2>
              <Tabs value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <TabsList>
                  <TabsTrigger value="relevance">Relevance</TabsTrigger>
                  <TabsTrigger value="date">Date</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
                {error.includes('Microsoft account not connected') && (
                  <Link 
                    href="/settings" 
                    className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Go to Settings
                  </Link>
                )}
              </div>
            ) : isSearching ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-lg text-muted-foreground">
                  No results found
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your search terms or filters
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedResults.map((group) => (
                  <div key={group.type} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 bg-white py-2">
                      {getIconForType(group.type)}
                      <h3 className="text-lg font-medium">{group.title}</h3>
                      <span className="text-sm text-gray-500">({group.results.length})</span>
                    </div>
                    <div className="space-y-2 pl-2">
                      {group.results.map((result) => (
                        <ResultItem key={result.id} result={result} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 