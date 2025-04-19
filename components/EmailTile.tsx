"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RotateCw, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { EmailMessage } from "@/lib/microsoft-graph";
import { EmailDialog } from "@/components/EmailDialog";
import { formatDistanceToNow } from "@/lib/utils";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/hooks";

interface EmailTileProps {
  emails: EmailMessage[];
  isLoading?: boolean;
  refreshInterval?: number;
  isCachedData?: boolean;
  onEmailClick?: (email: EmailMessage) => void;
  onRefresh?: () => Promise<void>;
}

// Define EmailThread type
type EmailThread = {
  id: string;
  subject: string;
  emails: EmailMessage[];
  latestEmail: EmailMessage;
  hasUnread: boolean;
};

// Email Thread Dialog Component
function EmailThreadDialog({
  thread,
  children,
  onEmailRead,
}: {
  thread: EmailThread;
  children: React.ReactNode;
  onEmailRead: (emailId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [threadEmails, setThreadEmails] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();

  // Fetch complete thread when dialog opens
  useEffect(() => {
    const fetchCompleteThread = async () => {
      if (!open || !thread.latestEmail.conversationId || !user?.id) return;

      setIsLoading(true);
      try {
        // Fetch the complete thread with full content
        const response = await fetch(
          `/api/emails/thread?conversationId=${thread.latestEmail.conversationId}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to fetch thread: ${response.status}`
          );
        }

        const data = await response.json();
        if (data.emails && Array.isArray(data.emails)) {
          if (data.emails.length > 0) {
            setThreadEmails(data.emails);
          } else {
            // If no emails in thread, fallback to original thread emails
            setThreadEmails(thread.emails);
          }
        }
      } catch (error) {
        console.error("Error fetching email thread:", error);
        // Always fallback to showing original thread emails
        setThreadEmails(thread.emails);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompleteThread();
  }, [open, thread, user?.id]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="line-clamp-1">
                {thread.subject} ({threadEmails.length || thread.emails.length})
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    try {
                      // Ensure we're getting all emails with complete content
                      const emails =
                        threadEmails.length > 0 ? threadEmails : thread.emails;

                      // Make sure we have all fields including the complete body content
                      // Log content stats before saving
                      console.log(
                        `Preparing to save ${emails.length} emails to localStorage for thread ${thread.id}`
                      );

                      // Make a deep copy to ensure we don't lose data during serialization
                      const emailsToStore = emails.map((email) => {
                        // Verify body content exists and is preserved
                        console.log(
                          `Preparing email "${
                            email.subject
                          }": bodyPreview length: ${
                            email.bodyPreview?.length || 0
                          }, body.content length: ${
                            email.body?.content?.length || 0
                          }`
                        );

                        // Create a clean copy with all needed fields
                        return {
                          id: email.id,
                          subject: email.subject,
                          from: email.from,
                          receivedDateTime: email.receivedDateTime,
                          bodyPreview: email.bodyPreview,
                          body: email.body, // Ensure this contains the complete content
                          webLink: email.webLink,
                          isRead: email.isRead,
                          conversationId: email.conversationId,
                          isSent: email.isSent,
                        };
                      });

                      const threadKey = `thread_${thread.id}`;

                      // Store the thread info with explicitly preserved email content
                      localStorage.setItem(
                        threadKey,
                        JSON.stringify({
                          subject: thread.subject,
                          emails: emailsToStore,
                        })
                      );

                      // Verify what was stored
                      const storedData = localStorage.getItem(threadKey);
                      const parsed = JSON.parse(storedData || "{}");
                      console.log(
                        `Thread verification: Stored ${
                          parsed.emails?.length || 0
                        } emails in localStorage`
                      );

                      // Check if body content was preserved
                      if (parsed.emails && parsed.emails.length > 0) {
                        parsed.emails.forEach(
                          (email: EmailMessage, i: number) => {
                            console.log(
                              `Stored email ${i + 1} "${
                                email.subject
                              }": bodyPreview length: ${
                                email.bodyPreview?.length || 0
                              }, body.content length: ${
                                email.body?.content?.length || 0
                              }`
                            );
                          }
                        );
                      }

                      // Open the chat with the thread ID
                      window.open(
                        `/ai-services/email/chat?threadId=${encodeURIComponent(
                          thread.id
                        )}&subject=${encodeURIComponent(thread.subject)}`,
                        "_blank"
                      );
                    } catch (err) {
                      console.error("Failed to save thread for chat:", err);
                    }
                  }}
                >
                  Send tråd til AI Chat
                </Button>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 p-1">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : threadEmails.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No emails found in this thread
            </div>
          ) : (
            threadEmails.map((email: EmailMessage) => (
              <div
                key={email.id}
                className={cn(
                  "border rounded-lg p-3",
                  !email.isRead && "bg-primary/5",
                  email.isSent && "border-primary/20 bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {email.isSent
                          ? "You"
                          : email.from?.emailAddress?.name ||
                            email.from?.emailAddress?.address ||
                            "Unknown Sender"}
                      </span>
                      {email.isSent && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Sent
                        </span>
                      )}
                      {!email.isRead && !email.isSent && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(email.receivedDateTime).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {email.webLink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(email.webLink, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Open in Outlook</span>
                      </Button>
                    )}
                    {!email.isSent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          try {
                            const emailKey = `email_${email.id}`;
                            localStorage.setItem(
                              emailKey,
                              JSON.stringify(email)
                            );
                            window.open(
                              `/ai-services/email/chat?id=${
                                email.id
                              }&subject=${encodeURIComponent(
                                email.subject || "Email"
                              )}`,
                              "_blank"
                            );
                          } catch (err) {
                            console.error(
                              "Failed to save email for chat:",
                              err
                            );
                          }
                        }}
                      >
                        AI Chat
                      </Button>
                    )}
                  </div>
                </div>

                {/* Email body - use full content if available */}
                <div className="text-sm mt-2 overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {email.body?.content ? (
                    <div
                      className="email-content"
                      dangerouslySetInnerHTML={{
                        __html: email.body.contentType.includes("html")
                          ? email.body.content
                          : email.body.content.replace(/\n/g, "<br/>"),
                      }}
                    />
                  ) : (
                    email.bodyPreview
                  )}
                </div>

                {/* Mark as read when opened */}
                {!email.isRead && !email.isSent && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto mt-2"
                    onClick={() => onEmailRead(email.id)}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailTile({
  emails: initialEmails = [],
  isLoading,
  refreshInterval = 300000,
  isCachedData = false,
  onEmailClick,
  onRefresh,
}: EmailTileProps) {
  const [emails, setEmails] = useState<EmailMessage[]>(initialEmails);
  const [showAll, setShowAll] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  // Group emails into conversation threads
  const emailThreads = useMemo<EmailThread[]>(() => {
    const threadMap = new Map<string, EmailMessage[]>();

    // Group emails by subject (ignoring prefixes like "Re:", "Fwd:", etc.)
    emails.forEach((email) => {
      const cleanSubject = (email.subject || "")
        .replace(/^(Re|Fwd|FW|RE|FWD|SV):\s*/i, "")
        .trim();

      if (!threadMap.has(cleanSubject)) {
        threadMap.set(cleanSubject, []);
      }

      threadMap.get(cleanSubject)?.push(email);
    });

    // Convert to array and sort threads by most recent email
    return Array.from(threadMap.entries())
      .map(([subject, threadEmails]) => {
        // Sort emails within thread by date (newest first)
        const sortedEmails = [...threadEmails].sort(
          (a, b) =>
            new Date(b.receivedDateTime).getTime() -
            new Date(a.receivedDateTime).getTime()
        );

        return {
          id: subject, // Use normalized subject as thread ID
          subject: subject || "(No subject)",
          emails: sortedEmails,
          latestEmail: sortedEmails[0],
          hasUnread: sortedEmails.some((email) => !email.isRead),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.latestEmail.receivedDateTime).getTime() -
          new Date(a.latestEmail.receivedDateTime).getTime()
      );
  }, [emails]);

  // Handle marking an email as read
  const handleEmailRead = (emailId: string) => {
    setEmails(
      emails.map((e) => (e.id === emailId ? { ...e, isRead: true } : e))
    );
  };

  // Display threads with pagination
  const displayThreads = showAll ? emailThreads : emailThreads.slice(0, 5);

  // Update emails when initialEmails change
  useEffect(() => {
    setEmails(initialEmails);
  }, [initialEmails]);

  // Toggle thread expansion
  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [threadId]: !prev[threadId],
    }));
  };

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    
    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-1 px-2 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="p-0.5 rounded-md bg-primary/10">
                <Mail className="h-3 w-3 text-primary" />
              </div>
              <span>Email Threads</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1.5 flex-1 overflow-hidden">
          <div className="space-y-1.5">
            <div className="h-10 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-10 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-10 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "h-full bg-gradient-to-br from-background to-muted/50 flex flex-col",
        isCachedData && "border-dashed"
      )}
    >
      <CardHeader
        className={cn(
          "py-1 px-2 border-b flex-none",
          isCachedData && "bg-muted/20"
        )}
      >
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "p-0.5 rounded-md bg-primary/10",
                isCachedData && "bg-muted/30"
              )}
            >
              <Mail
                className={cn(
                  "h-3 w-3 text-primary",
                  isCachedData && "text-muted-foreground"
                )}
              />
            </div>
            <span className="truncate">Email Threads</span>
            {isCachedData && (
              <span className="text-[8px] px-1 py-0.5 rounded-sm bg-muted/30 text-muted-foreground ml-0.5 hidden sm:inline-block">
                Cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 rounded-full hover:bg-muted/50"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
            {emailThreads.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 rounded-md hover:bg-muted/50"
                onClick={() => window.open("https://outlook.office.com/mail", "_blank")}
              >
                Outlook
                <ExternalLink className="ml-0.5 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1.5 flex-1 overflow-y-auto">
        {emailThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Mail className="h-5 w-5 mb-1.5 opacity-50" />
            <p className="text-xs">No recent emails</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayThreads.map((thread) => (
              <div key={thread.id} className="space-y-0.5">
                <EmailThreadDialog
                  thread={thread}
                  onEmailRead={handleEmailRead}
                >
                  <div
                    className={cn(
                      "rounded-md border px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer",
                      thread.hasUnread && "bg-accent/40 hover:bg-accent/50 border-accent-foreground/10"
                    )}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h3
                            className={cn(
                              "text-xs font-medium line-clamp-1",
                              thread.hasUnread && "font-semibold"
                            )}
                          >
                            {thread.subject}
                          </h3>
                          {thread.hasUnread && (
                            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {thread.latestEmail.from?.emailAddress?.name ||
                            thread.latestEmail.from?.emailAddress?.address ||
                            "Unknown"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(
                            new Date(thread.latestEmail.receivedDateTime)
                          )}{" "}
                          ago
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            className="text-[9px] px-1.5 py-0.5 text-primary bg-muted/30 rounded-sm hover:bg-primary/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              try {
                                // Save the thread to localStorage
                                const threadKey = `thread_${thread.id}`;
                                localStorage.setItem(
                                  threadKey,
                                  JSON.stringify({
                                    subject: thread.subject,
                                    emails: thread.emails,
                                  })
                                );

                                // Open the AI chat with the thread
                                window.open(
                                  `/ai-services/email/chat?threadId=${encodeURIComponent(
                                    thread.id
                                  )}&subject=${encodeURIComponent(thread.subject)}`,
                                  "_blank"
                                );
                              } catch (err) {
                                console.error("Failed to open thread in AI chat:", err);
                              }
                            }}
                          >
                            AI Chat
                          </button>
                          {thread.emails.length > 1 && (
                            <span className="text-[9px] px-1 py-0.5 bg-muted/30 rounded-sm">
                              {thread.emails.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </EmailThreadDialog>

                {/* Expanded thread view for individual emails */}
                {expandedThreads[thread.id] && (
                  <div className="pl-5 space-y-1.5 border-l-2 border-muted ml-2">
                    {thread.emails.map((email) => (
                      <EmailDialog
                        key={email.id}
                        email={email}
                        onEmailRead={() => handleEmailRead(email.id)}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-sm",
                            !email.isRead && "bg-primary/5 hover:bg-primary/10",
                            isCachedData && "opacity-90"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmailClick?.(email);
                          }}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs text-muted-foreground">
                                  {email.from?.emailAddress?.name ||
                                    email.from?.emailAddress?.address ||
                                    "Unknown Sender"}
                                </p>
                                {!email.isRead && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(
                                  email.receivedDateTime
                                ).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>

                            <button
                              className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();

                                // Save email to localStorage for the chat to use
                                try {
                                  const emailKey = `email_${email.id}`;
                                  localStorage.setItem(
                                    emailKey,
                                    JSON.stringify(email)
                                  );

                                  // Open the chat page with the email ID
                                  window.open(
                                    `/ai-services/email/chat?id=${
                                      email.id
                                    }&subject=${encodeURIComponent(
                                      email.subject || "Email"
                                    )}`,
                                    "_blank"
                                  );
                                } catch (err) {
                                  console.error(
                                    "Failed to save email for chat:",
                                    err
                                  );
                                }
                              }}
                            >
                              AI Chat
                            </button>
                          </div>
                        </div>
                      </EmailDialog>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {emailThreads.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-6 rounded-md hover:bg-muted/50"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show Less" : `Show ${emailThreads.length - 5} More`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
