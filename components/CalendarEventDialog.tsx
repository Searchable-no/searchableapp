'use client'

import { CalendarEvent } from '@/lib/microsoft-graph'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, Calendar, MapPin, Clock, Video, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CalendarEventDialogProps {
  event: CalendarEvent
  isOpen: boolean
  onClose: () => void
}

export function CalendarEventDialog({ event, isOpen, onClose }: CalendarEventDialogProps) {
  const formatEventTime = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const isSameDay = startDate.toDateString() === endDate.toDateString()
    
    const timeFormat: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    const dateFormat: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }
    
    if (isSameDay) {
      return `${startDate.toLocaleDateString('en-US', dateFormat)} · ${startDate.toLocaleTimeString('en-US', timeFormat)} - ${endDate.toLocaleTimeString('en-US', timeFormat)}`
    } else {
      return `${startDate.toLocaleDateString('en-US', dateFormat)} ${startDate.toLocaleTimeString('en-US', timeFormat)} - ${endDate.toLocaleDateString('en-US', dateFormat)} ${endDate.toLocaleTimeString('en-US', timeFormat)}`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="line-clamp-1">{event.subject}</span>
              {event.webLink && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(event.webLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open in Calendar</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{event.organizer.emailAddress.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Event details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatEventTime(event.start.dateTime, event.end.dateTime)}
              </span>
            </div>
            
            {event.location?.displayName && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location.displayName}</span>
              </div>
            )}
            
            {event.isOnline && (
              <div className="flex items-center gap-2 text-sm">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span>Online meeting available</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 