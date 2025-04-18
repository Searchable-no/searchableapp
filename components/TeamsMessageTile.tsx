"use client";

import { TeamsMessage } from "@/lib/microsoft-graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TeamsMessageDialog } from "@/components/TeamsMessageDialog";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface TeamsMessageTileProps {
  messages: TeamsMessage[];
  isLoading: boolean;
  isCachedData?: boolean;
  onRefresh?: () => Promise<void>;
}

function formatMessageContent(content: string): string {
  // Remove HTML tags
  const withoutTags = content.replace(/<[^>]*>/g, "");

  // Replace multiple spaces with a single space
  const withoutExtraSpaces = withoutTags.replace(/\s+/g, " ");

  // Replace markdown-style links [text](url) with just the text
  const withoutLinks = withoutExtraSpaces.replace(
    /\[([^\]]+)\]\([^)]+\)/g,
    "$1"
  );

  // Decode HTML entities
  const decoded = withoutLinks
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded.trim();
}

export function TeamsMessageTile({
  messages,
  isLoading,
  isCachedData,
  onRefresh,
}: TeamsMessageTileProps) {
  const [localMessages, setLocalMessages] = useState<TeamsMessage[]>(messages);
  const [selectedMessage, setSelectedMessage] = useState<TeamsMessage | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleMessageRead = (message: TeamsMessage) => {
    setLocalMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === message.id ? { ...msg, isRead: true } : msg
      )
    );
  };

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
        <CardHeader className="py-1 px-2 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="p-0.5 rounded-md bg-primary/10">
                <MessageSquare className="h-3 w-3 text-primary" />
              </div>
              <span>Teams Messages</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1.5 flex-1 overflow-hidden">
          <div className="space-y-1.5">
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <CardHeader className="py-1 px-2 border-b flex-none">
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="p-0.5 rounded-md bg-primary/10">
              <MessageSquare className="h-3 w-3 text-primary" />
            </div>
            <span className="truncate">Teams Messages</span>
            {isCachedData && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground">Cached</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 rounded-full hover:bg-muted/50"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 rounded-md hover:bg-muted/50"
                onClick={() =>
                  window.open("https://teams.microsoft.com", "_blank")
                }
              >
                Teams
                <ChevronRight className="ml-0.5 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1.5 flex-1 overflow-y-auto">
        {localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-5 w-5 mb-1.5 opacity-50" />
            <p className="text-xs">No recent messages</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {localMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "px-2 py-1.5 rounded-md border hover:bg-accent/30 cursor-pointer transition-colors"
                )}
                onClick={() => setSelectedMessage(message)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs line-clamp-2">
                        {formatMessageContent(
                          message.content || message.body?.content || ""
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      <p className="text-[9px] text-muted-foreground truncate max-w-[100px]">
                        {message.from?.user?.displayName || "Unknown"}
                      </p>
                      <span className="text-[9px] text-muted-foreground">•</span>
                      <p className="text-[9px] text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdDateTime))}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 mt-1 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {selectedMessage && (
        <TeamsMessageDialog
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => {
            handleMessageRead(selectedMessage);
            setSelectedMessage(null);
          }}
        />
      )}
    </Card>
  );
}
