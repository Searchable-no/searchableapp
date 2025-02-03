'use client'

import { useState } from 'react'
import { Calendar, ExternalLink, ChevronRight, Video } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { CalendarEvent } from '@/lib/microsoft-graph'
import { CalendarEventDialog } from '@/components/CalendarEventDialog'

interface CalendarTileProps {
  events: CalendarEvent[]
  isLoading: boolean
}

function formatEventTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export function CalendarTile({ events, isLoading }: CalendarTileProps) {
  const [showAll, setShowAll] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const displayEvents = showAll ? events : events.slice(0, 5)

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-none pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-2 h-full min-h-[200px]">
            <div className="h-14 animate-pulse rounded bg-muted"></div>
            <div className="h-14 animate-pulse rounded bg-muted"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Calendar
          </div>
          {events.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs px-2"
              onClick={() => window.open('https://outlook.office.com/calendar/view/day', '_blank')}
            >
              Open Calendar
              <ChevronRight className="ml-1 h-2 w-2" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        <div className="space-y-1">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events today</p>
          ) : (
            <>
              <div className="space-y-1">
                {displayEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="group relative rounded-sm border p-1.5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">
                          {event.subject}
                        </p>
                        {event.isOnline && (
                          <Video className="h-2 w-2 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(event.webLink, '_blank')
                          }}
                        >
                          <ExternalLink className="h-2 w-2" />
                          <span className="sr-only">Open event</span>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatEventTime(event.start.dateTime)}</span>
                      {event.location?.displayName && (
                        <span className="truncate ml-2">{event.location.displayName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {events.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-6"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show ${events.length - 5} More`}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
      {selectedEvent && (
        <CalendarEventDialog
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </Card>
  )
} 