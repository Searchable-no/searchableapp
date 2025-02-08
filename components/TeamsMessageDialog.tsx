"use client";

import { useEffect, useState } from "react";
import { TeamsMessage } from "@/lib/microsoft-graph";
import {
  fetchMessageThread,
  sendMessageReply,
  startNewThread,
} from "@/app/api/teams/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, AlertCircle, MessageSquare, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase-browser";
import { useUser } from "@/lib/hooks";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  markTeamsChatMessageAsRead,
  markTeamsChannelMessageAsRead,
} from "@/lib/microsoft-graph";

interface TeamsMessageDialogProps {
  message: TeamsMessage;
  isOpen: boolean;
  onClose: () => void;
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

export function TeamsMessageDialog({
  message,
  isOpen,
  onClose,
}: TeamsMessageDialogProps) {
  const { user, loading: userLoading } = useUser();
  const [reply, setReply] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thread, setThread] = useState<TeamsMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reply" | "new">("reply");
  const [databaseUserId, setDatabaseUserId] = useState<string | null>(null);

  // Get the database user ID when auth user is available
  useEffect(() => {
    async function getDatabaseUserId() {
      if (!user?.email) return null;

      try {
        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email.toLowerCase())
          .single();

        if (error) throw error;
        setDatabaseUserId(data.id);
      } catch (err) {
        console.error("Error getting database user ID:", err);
        setError(
          "Failed to get user information. Please try signing out and back in."
        );
      }
    }

    if (user?.email) {
      getDatabaseUserId();
    } else {
      setDatabaseUserId(null);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isOpen && message && databaseUserId) {
      loadThread();
    } else {
      // Clear state when dialog closes
      setThread([]);
      setError(null);
      setReply("");
      setNewThreadMessage("");
      setActiveTab("reply");
    }
  }, [isOpen, message, databaseUserId]);

  useEffect(() => {
    if (isOpen && !message.isRead && user?.id) {
      // Mark the message as read when the dialog opens
      const markAsRead = async () => {
        try {
          let success = false;
          if (message.channelIdentity) {
            // This is a channel message
            success = await markTeamsChannelMessageAsRead(
              user.id,
              message.channelIdentity.teamId,
              message.channelIdentity.channelId,
              message.id
            );
          } else {
            // This is a chat message
            const chatId = message.webUrl?.split("/chats/")[1]?.split("/")[0];
            if (chatId) {
              success = await markTeamsChatMessageAsRead(
                user.id,
                chatId,
                message.id
              );
            }
          }

          if (!success) {
            console.warn("Failed to mark message as read");
          }
        } catch (error) {
          console.error("Error marking message as read:", error);
        }
      };

      markAsRead();
    }
  }, [isOpen, message, user?.id]);

  const loadThread = async () => {
    if (!databaseUserId) return;

    setIsLoadingThread(true);
    setError(null);
    try {
      const messages = await fetchMessageThread(databaseUserId, message.id);
      setThread(messages);
    } catch (error: any) {
      console.error("Error loading thread:", error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !databaseUserId) return;

    setIsLoading(true);
    setError(null);
    try {
      await sendMessageReply(databaseUserId, message.id, reply);
      setReply("");
      // Reload the thread to show the new reply
      await loadThread();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewThread = async () => {
    if (!newThreadMessage.trim() || !databaseUserId) return;

    setIsLoading(true);
    setError(null);
    try {
      await startNewThread(
        databaseUserId,
        message.channelIdentity?.teamId || "",
        message.channelIdentity?.channelId || "",
        newThreadMessage
      );
      setNewThreadMessage("");
      onClose(); // Close dialog after successfully starting new thread
    } catch (error: any) {
      console.error("Error starting new thread:", error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: any): string => {
    if (error?.message === "Not authenticated") {
      return "You need to be signed in to perform this action. Please sign in and try again.";
    }
    if (error?.message === "Unauthorized") {
      return "You are not authorized to perform this action.";
    }
    if (error?.message === "Microsoft connection not found") {
      return "Your Microsoft account connection is not set up. Please connect your Microsoft account in settings.";
    }
    return "An unexpected error occurred. Please try again.";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="space-y-4 p-6 flex-none">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {message.from?.user?.displayName ? (
                  <span className="text-sm font-medium">
                    {message.from.user.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                ) : (
                  <MessageSquare className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg truncate">
                  {message.from?.user?.displayName || "Unknown User"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  {message.teamDisplayName && (
                    <>
                      <span className="truncate">
                        {message.teamDisplayName}
                      </span>
                      <span className="flex-none">•</span>
                    </>
                  )}
                  {message.channelDisplayName && (
                    <span className="flex items-center gap-1 truncate">
                      <span className="flex-none">#</span>
                      <span className="truncate">
                        {message.channelDisplayName}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            {message.webUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-none ml-4"
                onClick={() => window.open(message.webUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open in Teams
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Thread messages */}
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              {isLoadingThread ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              ) : thread.length > 0 ? (
                thread.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-lg p-4",
                      msg.id === message.id
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        {msg.from?.user?.displayName ? (
                          <span className="text-xs font-medium">
                            {msg.from.user.displayName
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
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {msg.from?.user?.displayName || "Unknown User"}
                          </span>
                          <span className="text-xs text-muted-foreground flex-none">
                            {formatDistanceToNow(
                              new Date(msg.createdDateTime || Date.now())
                            )}{" "}
                            ago
                          </span>
                        </div>
                        <div className="mt-1 text-sm break-words">
                          {formatMessageContent(msg.content || "")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No messages in thread
                </div>
              )}
            </div>

            {/* Reply/New Thread tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "reply" | "new")}
              className="mt-2"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reply">Reply in Thread</TabsTrigger>
                <TabsTrigger value="new">Start New Thread</TabsTrigger>
              </TabsList>
              <TabsContent value="reply" className="space-y-2 mt-2">
                <Textarea
                  placeholder="Type your reply..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-[100px] resize-none"
                  disabled={isLoading}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendReply}
                    disabled={!reply.trim() || isLoading}
                    className="relative"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent" />
                        <span>Sending...</span>
                      </div>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Reply in Thread
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="new" className="space-y-2 mt-2">
                <Textarea
                  placeholder="Start a new thread..."
                  value={newThreadMessage}
                  onChange={(e) => setNewThreadMessage(e.target.value)}
                  className="min-h-[100px] resize-none"
                  disabled={isLoading}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleStartNewThread}
                    disabled={!newThreadMessage.trim() || isLoading}
                    className="relative"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent" />
                        <span>Starting...</span>
                      </div>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start New Thread
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
