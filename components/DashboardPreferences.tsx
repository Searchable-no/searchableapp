import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Settings, GripVertical, Sun, Moon, Monitor } from 'lucide-react'
import { TileType } from '@/lib/database.types'
import { supabase } from '@/lib/supabase-browser'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DragDropContext, Draggable, Droppable, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd'
import { cn } from '@/lib/utils'

const tileNames: Record<TileType, string> = {
  email: 'Email Messages',
  teams_message: 'Teams Messages',
  teams_channel: 'Teams Channel Messages',
  calendar: 'Calendar Events',
  files: 'Recent Files',
  planner: 'Planner Tasks'
}

const tileIcons: Record<TileType, React.ReactNode> = {
  email: '📧',
  teams_message: '💬',
  teams_channel: '👥',
  calendar: '📅',
  files: '📁',
  planner: '📋'
}

const defaultTiles: TileType[] = ['email', 'teams_message', 'teams_channel', 'calendar', 'files', 'planner']
const defaultOrder = [0, 1, 2, 3, 4, 5]

interface TilePreferences {
  size: 'compact' | 'normal' | 'large'
  refreshInterval: number // in seconds
}

interface DashboardPreferences {
  enabledTiles: TileType[]
  tileOrder: number[]
  tilePreferences: Record<TileType, TilePreferences>
  theme: 'light' | 'dark' | 'system'
}

interface DashboardPreferencesProps {
  userId: string
  onPreferencesChange: (preferences: DashboardPreferences) => void
  initialPreferences?: DashboardPreferences
}

const defaultTilePreferences: TilePreferences = {
  size: 'normal',
  refreshInterval: 300 // 5 minutes
}

const defaultPreferences: DashboardPreferences = {
  enabledTiles: defaultTiles,
  tileOrder: defaultOrder,
  tilePreferences: Object.fromEntries(
    defaultTiles.map(tile => [tile, defaultTilePreferences])
  ) as Record<TileType, TilePreferences>,
  theme: 'system'
}

export function DashboardPreferences({ 
  userId, 
  onPreferencesChange,
  initialPreferences = defaultPreferences
}: DashboardPreferencesProps) {
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState<DashboardPreferences>(initialPreferences)
  const [saving, setSaving] = useState(false)
  const allTiles: TileType[] = ['email', 'teams_message', 'teams_channel', 'calendar', 'files', 'planner']

  useEffect(() => {
    setPreferences(initialPreferences)
  }, [initialPreferences])

  const savePreferences = async () => {
    if (saving) return
    setSaving(true)

    try {
      // First try to update only the basic fields that we know exist
      const { error: basicError } = await supabase
        .from('dashboard_preferences')
        .upsert({
          user_id: userId,
          enabled_tiles: preferences.enabledTiles,
          tile_order: preferences.tileOrder,
          updated_at: new Date().toISOString()
        })

      if (basicError) {
        console.error('Error saving basic preferences:', basicError)
        toast.error(`Failed to save preferences: ${basicError.message}`)
        return
      }

      // Try to update the new fields, but ignore any errors if the columns don't exist yet
      try {
        await supabase
          .from('dashboard_preferences')
          .update({
            tile_preferences: preferences.tilePreferences,
            theme: preferences.theme,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
      } catch (err) {
        // Ignore errors from missing columns
        console.log('New columns not available yet:', err)
      }

      onPreferencesChange(preferences)
      toast.success('Dashboard preferences saved')
      setOpen(false)
    } catch (err) {
      console.error('Unexpected error saving preferences:', err)
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const toggleTile = (tile: TileType) => {
    setPreferences(prev => {
      if (prev.enabledTiles.includes(tile)) {
        // Remove tile
        const newEnabledTiles = prev.enabledTiles.filter(t => t !== tile)
        const newTileOrder = prev.tileOrder.filter((_, index) => index < newEnabledTiles.length)
        return {
          ...prev,
          enabledTiles: newEnabledTiles,
          tileOrder: newTileOrder
        }
      } else {
        // Add tile
        const newEnabledTiles = [...prev.enabledTiles, tile]
        const newTileOrder = [...prev.tileOrder, prev.tileOrder.length]
        return {
          ...prev,
          enabledTiles: newEnabledTiles,
          tileOrder: newTileOrder
        }
      }
    })
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(preferences.enabledTiles)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const newOrder = items.map((_, index) => index)

    setPreferences(prev => ({
      ...prev,
      enabledTiles: items,
      tileOrder: newOrder
    }))
  }

  const updateTilePreference = (tile: TileType, key: keyof TilePreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      tilePreferences: {
        ...prev.tilePreferences,
        [tile]: {
          ...prev.tilePreferences[tile],
          [key]: value
        }
      }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dashboard Preferences</DialogTitle>
          <DialogDescription>
            Customize your dashboard layout and appearance.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tiles" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tiles">Tiles</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
          </TabsList>

          <TabsContent value="tiles" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <CardDescription className="mb-4">
                  Enable or disable tiles and drag to reorder them.
                </CardDescription>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="tiles">
                    {(provided: DroppableProvided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {preferences.enabledTiles.map((tile, index) => (
                          <Draggable key={tile} draggableId={tile} index={index}>
                            {(provided: DraggableProvided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg"
                              >
                                <div className="flex items-center gap-4">
                                  <div {...provided.dragHandleProps}>
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                  <span className="text-lg mr-2">{tileIcons[tile]}</span>
                                  <Label htmlFor={tile} className="font-medium">
                                    {tileNames[tile]}
                                  </Label>
                                </div>
                                <Switch
                                  id={tile}
                                  checked={preferences.enabledTiles.includes(tile)}
                                  onCheckedChange={() => toggleTile(tile)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="flex items-center justify-between">
                      <Select
                        value={preferences.theme}
                        onValueChange={(value: 'light' | 'dark' | 'system') => 
                          setPreferences(prev => ({ ...prev, theme: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center gap-2">
                              <Sun className="h-4 w-4" />
                              <span>Light</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4" />
                              <span>Dark</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="system">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              <span>System</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                {preferences.enabledTiles.map((tile) => (
                  <div key={tile} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tileIcons[tile]}</span>
                      <h3 className="font-medium">{tileNames[tile]}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 ml-8">
                      <div className="space-y-2">
                        <Label>Size</Label>
                        <Select
                          value={preferences.tilePreferences[tile].size}
                          onValueChange={(value: 'compact' | 'normal' | 'large') => 
                            updateTilePreference(tile, 'size', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compact">Compact</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Refresh Interval</Label>
                        <Select
                          value={preferences.tilePreferences[tile].refreshInterval.toString()}
                          onValueChange={(value) => 
                            updateTilePreference(tile, 'refreshInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="60">1 minute</SelectItem>
                            <SelectItem value="300">5 minutes</SelectItem>
                            <SelectItem value="600">10 minutes</SelectItem>
                            <SelectItem value="1800">30 minutes</SelectItem>
                            <SelectItem value="3600">1 hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setPreferences(initialPreferences)
              setOpen(false)
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            onClick={savePreferences}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 