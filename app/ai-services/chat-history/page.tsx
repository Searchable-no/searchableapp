"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export default function ChatHistoryPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ChatType | "all">("all");

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user?.id) return;

      setIsLoading(true);

      try {
        const type =
          selectedType !== "all" ? (selectedType as ChatType) : undefined;
        const history = await chatHistoryService.getUserChats(user.id, type);
        setChatHistory(history);
      } catch (error) {
        console.error("Error loading chat history:", error);
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
    switch (chat.type) {
      case "transcription":
        return `/ai-services/transcription/chat?id=${chat.thread_id}&chatId=${chat.id}`;
      case "email":
        // Check if this is an email thread or single email from metadata
        if (chat.metadata?.isEmailThread) {
          return `/ai-services/email/chat?threadId=${chat.thread_id}&chatId=${chat.id}&subject=${encodeURIComponent(chat.title)}`;
        } else {
          return `/ai-services/email/chat?id=${chat.thread_id}&chatId=${chat.id}&subject=${encodeURIComponent(chat.title)}`;
        }
      case "normal":
        return `/ai-services/chat?chatId=${chat.id}`;
      default:
        return `/ai-services/chat?chatId=${chat.id}`;
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
          ) : chatHistory.length > 0 ? (
            <div className="space-y-4">
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <Link href={getChatLink(chat)} className="flex-1">
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
