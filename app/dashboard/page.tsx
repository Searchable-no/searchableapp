'use client'

import { useState, useEffect } from 'react'
import { EmailTile } from '@/components/EmailTile'
import { TeamsMessageTile } from '@/components/TeamsMessageTile'
import { TeamsChannelTile } from '@/components/TeamsChannelTile'
import { CalendarTile } from '@/components/CalendarTile'
import { RecentFilesTile } from '@/components/RecentFilesTile'
import { DashboardPreferences } from '@/components/DashboardPreferences'
import { TileType } from '@/lib/database.types'
import { getData } from './actions'
import { useUser } from '@/lib/hooks'
import { supabase } from '@/lib/supabase-browser'
import { PlannerTile } from '@/components/PlannerTile'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { AlertCircle, Users } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { TeamsDialog } from '@/components/TeamsDialog'
import { Button } from '@/components/ui/button'
import { SharePointSearch } from '@/components/SharePointSearch'

const tileComponents: Record<TileType, React.ComponentType<any>> = {
  email: EmailTile,
  teams_message: TeamsMessageTile,
  teams_channel: TeamsChannelTile,
  calendar: CalendarTile,
  files: RecentFilesTile,
  planner: PlannerTile
}

const defaultTiles: TileType[] = ['email', 'teams_message', 'teams_channel', 'calendar', 'files', 'planner']
const defaultOrder = [0, 1, 2, 3, 4, 5]

const defaultTilePreferences = {
  size: 'normal' as const,
  refreshInterval: 300 // 5 minutes
}

interface DashboardPreferences {
  enabledTiles: TileType[]
  tileOrder: number[]
  tilePreferences: Record<TileType, {
    size: 'compact' | 'normal' | 'large'
    refreshInterval: number
  }>
  theme: 'light' | 'dark' | 'system'
}

const defaultPreferences: DashboardPreferences = {
  enabledTiles: defaultTiles,
  tileOrder: defaultOrder,
  tilePreferences: Object.fromEntries(
    defaultTiles.map(tile => [tile, defaultTilePreferences])
  ) as Record<TileType, typeof defaultTilePreferences>,
  theme: 'system'
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const { setTheme } = useTheme()
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false)

  useEffect(() => {
    if (!userLoading && user?.id && user?.email) {
      fetchData()
      loadPreferences()
    }
  }, [user?.id, user?.email, userLoading])

  useEffect(() => {
    // Apply theme whenever it changes
    setTheme(preferences.theme)
  }, [preferences.theme, setTheme])

  const loadPreferences = async () => {
    if (!user?.id) return

    try {
      const { data: allPrefs, error: fetchError } = await supabase
        .from('dashboard_preferences')
        .select('enabled_tiles,tile_order,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchError) {
        throw fetchError
      }

      if (allPrefs) {
        // Set preferences in state, using defaults for any missing fields
        setPreferences({
          enabledTiles: allPrefs.enabled_tiles || defaultPreferences.enabledTiles,
          tileOrder: allPrefs.tile_order || defaultPreferences.tileOrder,
          tilePreferences: defaultPreferences.tilePreferences,
          theme: defaultPreferences.theme
        })
      } else {
        // No preferences found, create default without the new columns
        const { error: createError } = await supabase
          .from('dashboard_preferences')
          .insert({
            user_id: user.id,
            enabled_tiles: defaultPreferences.enabledTiles,
            tile_order: defaultPreferences.tileOrder,
            updated_at: new Date().toISOString()
          })

        if (createError) {
          console.error('Error creating default preferences:', createError)
        }
      }
    } catch (err) {
      console.error('Error loading preferences:', err)
      // Use default values if there's an error
      setPreferences(defaultPreferences)
    } finally {
      setPreferencesLoaded(true)
    }
  }

  const fetchData = async () => {
    if (!user?.email) return
    setIsLoading(true)
    try {
      const result = await getData()
      setData(result)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreferencesChange = (newPreferences: DashboardPreferences) => {
    setPreferences(newPreferences)
  }

  if (userLoading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please log in to view your dashboard.</div>
  }

  if (isLoading || !data || !preferencesLoaded) {
    return <DashboardSkeleton />
  }

  if (data?.error) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">{data.error}</h2>
          {data.error === 'Microsoft account not connected' && (
            <div className="space-y-2">
              <p>Please connect your Microsoft account to view your dashboard.</p>
              <Link 
                href="/settings" 
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const getTileData = (tileType: TileType) => {
    switch (tileType) {
      case 'email':
        return { emails: data.emails, isLoading: !data.emails?.length }
      case 'teams_message':
        return { messages: data.teamsMessages, isLoading: !data.teamsMessages?.length, userId: data.userId }
      case 'teams_channel':
        return { messages: data.channelMessages, isLoading: !data.channelMessages?.length, userId: data.userId }
      case 'calendar':
        return { events: data.events, isLoading: !data.events?.length }
      case 'files':
        return { files: data.files, isLoading: !data.files?.length }
      case 'planner':
        return { 
          tasks: data.plannerTasks, 
          isLoading: !data.plannerTasks?.length, 
          userId: data.userId,
          refreshInterval: preferences.tilePreferences.planner.refreshInterval * 1000, // Convert to milliseconds
          onRefresh: async () => {
            try {
              const result = await getData()
              setData(result)
            } catch (err) {
              console.error('Error refreshing data:', err)
            }
          }
        }
      default:
        return {}
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="mb-8">
        <SharePointSearch />
      </div>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTeamsDialogOpen(true)}
            >
              <Users className="h-5 w-5" />
            </Button>
            <DashboardPreferences
              userId={user?.id || ''}
              onPreferencesChange={handlePreferencesChange}
              initialPreferences={preferences}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {preferences.enabledTiles.map((tileType, index) => {
            const TileComponent = tileComponents[tileType]
            const tileData = getTileData(tileType)
            const tilePrefs = preferences.tilePreferences[tileType]
            
            return (
              <div 
                key={tileType}
                className={cn(
                  "col-span-1",
                  tilePrefs.size === 'compact' && "min-h-[150px] max-h-[200px]",
                  tilePrefs.size === 'normal' && "min-h-[200px] max-h-[300px]",
                  tilePrefs.size === 'large' && "min-h-[300px] max-h-[400px]"
                )}
                style={{ order: preferences.tileOrder[index] }}
              >
                <TileComponent 
                  {...tileData} 
                  refreshInterval={tilePrefs.refreshInterval * 1000} // Convert to milliseconds
                />
              </div>
            )
          })}
        </div>

        {!userLoading && (
          <TeamsDialog
            isOpen={teamsDialogOpen}
            onClose={() => setTeamsDialogOpen(false)}
          />
        )}
      </div>
    </div>
  )
} 