"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { EmailMessage } from "@/lib/microsoft-graph";
import { EmailDialog } from "@/components/EmailDialog";
import { formatDistanceToNow } from "@/lib/utils";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";

interface EmailTileProps {
  emails: EmailMessage[];
  isLoading?: boolean;
  refreshInterval?: number;
  isCachedData?: boolean;
}

export function EmailTile({
  emails: initialEmails = [],
  isLoading,
  refreshInterval = 300000,
  isCachedData = false,
}: EmailTileProps) {
  const [emails, setEmails] = useState<EmailMessage[]>(initialEmails);
  const [showAll, setShowAll] = useState(false);
  const displayEmails = showAll ? emails : emails.slice(0, 5);

  const { isRefreshing, lastRefreshed, refresh } = useAutoRefresh({
    refreshInterval,
    onRefresh: async () => {
      try {
        const response = await fetch("/api/emails/recent");
        if (!response.ok) throw new Error("Failed to fetch emails");
        const data = await response.json();
        setEmails(data.emails);
      } catch (error) {
        console.error("Error refreshing emails:", error);
      }
    },
  });

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50">
        <CardHeader className="py-1.5 px-2.5 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-primary/10">
                <Mail className="h-3 w-3 text-primary" />
              </div>
              <span>Recent Emails</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-1">
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "h-full bg-gradient-to-br from-background to-muted/50 flex flex-col",
      isCachedData && "border-dashed"
    )}>
      <CardHeader className={cn(
        "py-1.5 px-2.5 border-b flex-none",
        isCachedData && "bg-muted/20"
      )}>
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "p-1 rounded-md bg-primary/10",
              isCachedData && "bg-muted/30"
            )}>
              <Mail className={cn(
                "h-3 w-3 text-primary",
                isCachedData && "text-muted-foreground"
              )} />
            </div>
            <span>Recent Emails</span>
            {isCachedData && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted/30 text-muted-foreground ml-1">
                Cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastRefreshed)} ago
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md"
              onClick={() => refresh()}
              disabled={isRefreshing}
            >
              <RotateCw
                className={cn("h-3 w-3", isRefreshing && "animate-spin")}
              />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex-1 overflow-y-auto">
        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Mail className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-xs">No recent emails</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayEmails.map((email) => (
              <EmailDialog
                key={email.id}
                email={email}
                onEmailRead={() => {
                  setEmails(
                    emails.map((e) =>
                      e.id === email.id ? { ...e, isRead: true } : e
                    )
                  );
                }}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
                    !email.isRead && "bg-primary/5 hover:bg-primary/10",
                    isCachedData && "opacity-90"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3
                          className={cn(
                            "text-xs truncate",
                            !email.isRead && "font-semibold"
                          )}
                        >
                          {email.subject || "(No subject)"}
                        </h3>
                        {!email.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.from?.emailAddress?.name ||
                          email.from?.emailAddress?.address ||
                          "Unknown Sender"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(email.receivedDateTime))}
                      </p>
                    </div>
                  </div>
                </div>
              </EmailDialog>
            ))}
            {emails.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-6 rounded-md hover:bg-muted/50"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show Less" : `Show ${emails.length - 5} More`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
