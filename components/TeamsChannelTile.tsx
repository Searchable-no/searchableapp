"use client";

import { TeamsChannelMessage } from "@/lib/microsoft-graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TeamsMessageDialog } from "@/components/TeamsMessageDialog";
import { formatDistanceToNow } from "date-fns";

interface TeamsChannelTileProps {
  messages: TeamsChannelMessage[];
  isLoading: boolean;
}

function formatMessageContent(content: string): string {
  const withoutTags = content.replace(/<[^>]*>/g, "");
  const withoutExtraSpaces = withoutTags.replace(/\s+/g, " ");
  const withoutLinks = withoutExtraSpaces.replace(
    /\[([^\]]+)\]\([^)]+\)/g,
    "$1"
  );
  const decoded = withoutLinks
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.trim();
}

function groupMessagesByTeam(messages: TeamsChannelMessage[]) {
  const groups: { [key: string]: { [key: string]: TeamsChannelMessage[] } } =
    {};

  messages.forEach((message) => {
    if (!groups[message.teamName]) {
      groups[message.teamName] = {};
    }
    if (!groups[message.teamName][message.channelName]) {
      groups[message.teamName][message.channelName] = [];
    }
    groups[message.teamName][message.channelName].push(message);
  });

  return groups;
}

export function TeamsChannelTile({
  messages,
  isLoading,
}: TeamsChannelTileProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<TeamsChannelMessage | null>(null);
  const displayMessages = showAll ? messages : messages.slice(0, 5);
  const groupedMessages = groupMessagesByTeam(displayMessages);

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-2 px-3 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>Teams Channels</span>
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
            <span>Teams Channels</span>
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
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No channel messages</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([teamName, channels]) => (
              <div key={teamName} className="space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="h-3 w-3" />
                  </div>
                  <span className="truncate">{teamName}</span>
                </h3>
                {Object.entries(channels).map(
                  ([channelName, channelMessages]) => (
                    <div
                      key={`${teamName}-${channelName}`}
                      className="space-y-2 ml-8"
                    >
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <span className="flex-none">#</span>
                        <span className="truncate">{channelName}</span>
                      </h4>
                      <div className="space-y-2">
                        {channelMessages.map((message) => (
                          <div
                            key={message.id}
                            className="group p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                            onClick={() => setSelectedMessage(message)}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                {message.from?.user?.displayName ? (
                                  <span className="text-xs font-medium">
                                    {message.from.user.displayName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </span>
                                ) : (
                                  <MessageSquare className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {message.from?.user?.displayName ||
                                        "Unknown User"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatDistanceToNow(
                                        new Date(
                                          message.createdDateTime || Date.now()
                                        )
                                      )}{" "}
                                      ago
                                    </p>
                                  </div>
                                  {message.webUrl &&
                                    typeof message.webUrl === "string" && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(message.webUrl, "_blank");
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        <span className="sr-only">
                                          Open in Teams
                                        </span>
                                      </Button>
                                    )}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground line-clamp-2 break-words">
                                  {message.content
                                    ? formatMessageContent(message.content)
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ))}
            {messages.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-7 rounded-md hover:bg-muted/50"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show Less" : `Show ${messages.length - 5} More`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
      {selectedMessage && (
        <TeamsMessageDialog
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </Card>
  );
}
