"use client";

import { useState, useEffect, useMemo } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { chatHistoryService } from "@/services/chatHistoryService";
import { ChatHistory, ChatType } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Mail,
  MessageSquare,
  Trash2,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export default function ChatHistoryPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ChatType | "all">("all");
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user?.id) {
        console.log("User not loaded yet, will retry when user is available");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const type =
          selectedType !== "all" ? (selectedType as ChatType) : undefined;
        console.log(
          "Loading chat history for user:",
          user.id,
          "type:",
          type || "all"
        );
        const history = await chatHistoryService.getUserChats(user.id, type);

        console.log(`Loaded ${history.length} chat history items`);

        // Validate each chat history item
        const validHistory = history.filter((chat) => {
          if (!chat.content || !Array.isArray(chat.content.messages)) {
            console.error("Invalid chat structure:", chat.id);
            return false;
          }
          return true;
        });

        if (validHistory.length !== history.length) {
          console.warn(
            `Filtered out ${history.length - validHistory.length} invalid chats`
          );
        }

        setChatHistory(validHistory);
      } catch (error) {
        console.error("Error loading chat history:", error);
        setError(
          "Kunne ikke laste chathistorikk. Vennligst prøv igjen senere."
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!userLoading) {
      loadChatHistory();
    }
  }, [user, userLoading, selectedType]);

  const deleteChat = async (chatId: string) => {
    if (confirm("Er du sikker på at du vil slette denne samtalen?")) {
      const success = await chatHistoryService.deleteChat(chatId);
      if (success) {
        setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));
      }
    }
  };

  // Function to get the appropriate link for chat type
  const getChatLink = (chat: ChatHistory) => {
    // Ensure chat has an ID
    if (!chat.id) {
      console.error("Missing chat ID for chat:", chat);
      return "/ai-services"; // Fallback to AI services page
    }

    // Logging to help debug
    console.log("Getting link for chat:", {
      id: chat.id,
      type: chat.type,
      thread_id: chat.thread_id,
      hasMessages: chat.content?.messages?.length || 0,
    });

    // Check if the chat content is valid
    if (!chat.content || !Array.isArray(chat.content.messages)) {
      console.error("Invalid chat content structure for chat ID:", chat.id);
      // Return just the chat ID as fallback to avoid errors
      return `/ai-services/chat?chatId=${chat.id}`;
    }

    // Ensure we always have a valid chat ID in the URL
    const chatIdParam = `chatId=${chat.id}`;

    // Original switch block with additional logging
    switch (chat.type) {
      case "transcription":
        const transcriptionUrl = `/ai-services/transcription/chat?${chatIdParam}${chat.thread_id ? `&id=${chat.thread_id}` : ""}`;
        console.log("Generated transcription URL:", transcriptionUrl);
        return transcriptionUrl;
      case "email":
        // Check if this is an email thread or single email from metadata
        let emailUrl;
        if (chat.metadata?.isEmailThread) {
          emailUrl = `/ai-services/email/chat?${chatIdParam}${chat.thread_id ? `&threadId=${chat.thread_id}` : ""}&subject=${encodeURIComponent(chat.title)}`;
        } else {
          emailUrl = `/ai-services/email/chat?${chatIdParam}${chat.thread_id ? `&id=${chat.thread_id}` : ""}&subject=${encodeURIComponent(chat.title)}`;
        }
        console.log("Generated email URL:", emailUrl);
        return emailUrl;
      case "normal":
        const normalUrl = `/ai-services/chat?${chatIdParam}`;
        console.log("Generated normal chat URL:", normalUrl);
        return normalUrl;
      default:
        const defaultUrl = `/ai-services/chat?${chatIdParam}`;
        console.log("Generated default URL:", defaultUrl);
        return defaultUrl;
    }
  };

  // Icon for each chat type
  const getChatIcon = (type: ChatType) => {
    switch (type) {
      case "transcription":
        return <FileText className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Format date with fallback
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return format(parseISO(dateString), "dd.MM.yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  // Get type name in Norwegian
  const getTypeName = (type: ChatType) => {
    switch (type) {
      case "transcription":
        return "Transkribering";
      case "email":
        return "E-post";
      default:
        return "Chat";
    }
  };

  // Get preview of chat messages
  const getChatPreview = (chat: ChatHistory) => {
    // If there's a last message already set, use it
    if (chat.content.lastMessage) {
      return chat.content.lastMessage;
    }

    // Otherwise look for the last message in the messages array
    if (chat.content.messages && chat.content.messages.length > 0) {
      const lastMessage =
        chat.content.messages[chat.content.messages.length - 1];
      return lastMessage.content || "Ingen meldinger";
    }

    return "Ingen meldinger";
  };

  // Group chats by thread_id
  const groupedChats = useMemo(() => {
    const groups: Record<string, ChatHistory[]> = {};
    const standalone: ChatHistory[] = [];

    // First group conversations by thread_id
    chatHistory.forEach((chat) => {
      if (chat.thread_id) {
        if (!groups[chat.thread_id]) {
          groups[chat.thread_id] = [];
        }
        groups[chat.thread_id].push(chat);
      } else {
        standalone.push(chat);
      }
    });

    // Sort chats within each group by date (newest first)
    Object.keys(groups).forEach((threadId) => {
      groups[threadId].sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
    });

    return { groups, standalone };
  }, [chatHistory]);

  // Toggle thread expansion
  const toggleThreadExpansion = (threadId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [threadId]: !prev[threadId],
    }));
  };

  // Render a chat item
  const renderChatItem = (chat: ChatHistory) => {
    // Skip rendering if chat doesn't have required properties
    if (!chat.id || !chat.content || !Array.isArray(chat.content.messages)) {
      console.error("Invalid chat object:", chat);
      return null;
    }

    const chatLink = getChatLink(chat);

    return (
      <div className="flex justify-between items-start">
        <Link
          href={chatLink}
          className="flex-1"
          onClick={() => {
            // Log when chat link is clicked
            console.log("Chat link clicked:", chatLink, "Chat ID:", chat.id);
            // Add a flag to localStorage to track that we're coming from history
            localStorage.setItem("fromChatHistory", "true");
            localStorage.setItem("selectedChatId", chat.id || "");
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {getChatIcon(chat.type)}
            <h3 className="font-medium">{chat.title}</h3>
            <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
              {getTypeName(chat.type)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {getChatPreview(chat)}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(chat.updated_at)}</span>
          </div>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => chat.id && deleteChat(chat.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <a
          href="/ai-services"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          AI Tjenester
        </a>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Chat Historie</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Chat Historie</h1>
      <p className="text-muted-foreground mb-6">Se tidligere AI-samtaler</p>

      <Tabs
        defaultValue="all"
        onValueChange={(value) => setSelectedType(value as ChatType | "all")}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="normal">Chat</TabsTrigger>
          <TabsTrigger value="transcription">Transkribering</TabsTrigger>
          <TabsTrigger value="email">E-post</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="mt-0">
          {isLoading || userLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="text-center p-12 border rounded-lg bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive font-medium">{error}</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Prøv igjen
              </Button>
            </div>
          ) : chatHistory.length > 0 ? (
            <div className="space-y-4">
              {/* Thread groups first */}
              {Object.entries(groupedChats.groups).map(([threadId, chats]) => {
                const mainChat = chats[0]; // First chat (latest) in thread
                const isExpanded = expandedThreads[threadId] || false;

                return (
                  <div
                    key={threadId}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Thread header */}
                    <div className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={getChatLink(mainChat)} className="flex-1">
                          <div className="flex items-center gap-2">
                            {getChatIcon(mainChat.type)}
                            <h3 className="font-medium">{mainChat.title}</h3>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                              {getTypeName(mainChat.type)}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-primary/10 rounded-full text-primary ml-1">
                              {chats.length} samtaler
                            </span>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleThreadExpansion(threadId);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <Link href={getChatLink(mainChat)} className="block">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {getChatPreview(mainChat)}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(mainChat.updated_at)}</span>
                        </div>
                      </Link>
                    </div>

                    {/* Thread conversations */}
                    {isExpanded && (
                      <div className="border-t">
                        {chats.map((chat, index) => (
                          <div
                            key={chat.id}
                            className={`p-4 ${index > 0 ? "border-t" : ""} bg-muted/10`}
                          >
                            {renderChatItem(chat)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone chats */}
              {groupedChats.standalone.map((chat) => (
                <div
                  key={chat.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  {renderChatItem(chat)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-12 border rounded-lg bg-muted/30">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Ingen samtaler funnet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
