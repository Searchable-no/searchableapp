"use client";

import { TeamsMessage } from "@/lib/microsoft-graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TeamsMessageDialog } from "@/components/TeamsMessageDialog";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface TeamsMessageTileProps {
  messages: TeamsMessage[];
  isLoading: boolean;
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
}: TeamsMessageTileProps) {
  const [localMessages, setLocalMessages] = useState<TeamsMessage[]>(messages);
  const [selectedMessage, setSelectedMessage] = useState<TeamsMessage | null>(
    null
  );

  const handleMessageRead = (message: TeamsMessage) => {
    setLocalMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === message.id ? { ...msg, isRead: true } : msg
      )
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-2 px-3 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>Teams Messages</span>
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
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Teams Messages</span>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 rounded-md hover:bg-muted/50"
              onClick={() =>
                window.open("https://teams.microsoft.com", "_blank")
              }
            >
              Open Teams
              <ChevronRight className="ml-1 h-2 w-2" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto">
        {localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No recent messages</p>
          </div>
        ) : (
          <div className="space-y-3">
            {localMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                )}
                onClick={() => setSelectedMessage(message)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm line-clamp-2">
                        {formatMessageContent(
                          message.content || message.body?.content || ""
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {message.from?.user?.displayName || "Unknown"}
                      </p>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdDateTime))}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
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
