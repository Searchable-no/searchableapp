"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, Video, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CalendarEvent } from "@/lib/microsoft-graph";
import { CalendarEventDialog } from "@/components/CalendarEventDialog";
import { cn } from "@/lib/utils";

interface CalendarTileProps {
  events: CalendarEvent[];
  isLoading: boolean;
  isCachedData?: boolean;
  onRefresh?: () => Promise<void>;
}

export function CalendarTile({ 
  events, 
  isLoading, 
  isCachedData, 
  onRefresh 
}: CalendarTileProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-2 px-3 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>Calendar</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 flex-1">
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <CardHeader className="py-2 px-3 border-b flex-none">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Calendar</span>
            {isCachedData && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted-foreground/20 text-muted-foreground">
                Cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full hover:bg-muted/50"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
            {events.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 rounded-md hover:bg-muted/50"
                onClick={() =>
                  window.open(
                    "https://outlook.office.com/calendar/view/day",
                    "_blank"
                  )
                }
              >
                Open Calendar
                <CalendarIcon className="ml-1 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CalendarIcon className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No events today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="group p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium truncate">
                          {event.subject}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(event.start.dateTime)} -{" "}
                            {formatDate(event.end.dateTime)}
                          </p>
                          {event.isOnline && (
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <Video className="h-3 w-3" />
                              <span>Online</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {event.location?.displayName && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        📍 {event.location.displayName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {selectedEvent && (
        <CalendarEventDialog
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </Card>
  );
}
