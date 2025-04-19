"use client";

import {
  ChevronRight,
  Bookmark,
  BookmarkPlus,
  Pencil,
  Trash,
  MoreVertical,
  MessageSquare,
  ChevronDown,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { useChat, chatStore } from "./chat-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { chatHistoryService } from "@/services/chatHistoryService";
import { useState } from "react";

export function ChatHeader() {
  const { chatTitle, chatId, bookmarked, selectedModel } = useChat();
  const router = useRouter();
  const [diagnostics, setDiagnostics] = useState<{
    running: boolean;
    results: any | null;
  }>({
    running: false,
    results: null,
  });

  const handleRename = async () => {
    const newTitle = prompt("Enter a new title for this chat:", chatTitle);
    if (newTitle && newTitle.trim() !== "" && newTitle !== chatTitle) {
      const success = await chatStore.updateTitle(newTitle.trim());
      if (!success) {
        alert("Failed to rename chat");
      }
    }
  };

  const handleToggleBookmark = async () => {
    const success = await chatStore.toggleBookmark();
    if (!success) {
      alert("Failed to update bookmark status");
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this chat? This cannot be undone."
      )
    ) {
      const success = await chatStore.deleteChat();
      if (success) {
        // Navigate back to the AI services page
        router.push("/ai-services");
      } else {
        alert("Failed to delete chat");
      }
    }
  };

  const handleModelSelect = (model: string) => {
    chatStore.setSelectedModel(model);
  };

  const handleNavigateBack = () => {
    router.push("/ai-services");
  };

  const runDiagnostics = async () => {
    setDiagnostics({ running: true, results: null });

    try {
      // 1. Verify database connection
      const dbStatus = await chatHistoryService.verifyDatabase();

      // 2. Check if currentChatId exists
      let chatStatus = null;
      const currentChatId = chatStore.chatId;

      if (currentChatId) {
        const chat = await chatHistoryService.getChatById(currentChatId);
        chatStatus = {
          exists: !!chat,
          messageCount: chat?.content?.messages?.length || 0,
          userId: chat?.user_id || "unknown",
          title: chat?.title || "unknown",
        };
      }

      setDiagnostics({
        running: false,
        results: {
          database: dbStatus,
          currentChat: chatStatus,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      setDiagnostics({
        running: false,
        results: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  // Show a simplified title when no chatId exists yet
  const displayTitle = chatId ? chatTitle : "Ny chat - ikke lagret ennå";

  return (
    <header className="flex flex-col border-b shadow-sm">
      {/* Breadcrumb navigation */}
      <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a
            href="/ai-services"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            AI Tjenester
          </a>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">Chat</span>
          {!chatId && (
            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md ml-2">
              Ny
            </span>
          )}
        </div>
      </div>

      {/* Header with title and controls */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 mr-2"
            onClick={handleNavigateBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Tilbake</span>
          </Button>

          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 text-primary mr-2" />
            <h1 className="text-md font-medium">{displayTitle}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => document.getElementById("model-dropdown")?.click()}
            >
              <span className="mr-1">{selectedModel}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
            <select
              id="model-dropdown"
              value={selectedModel}
              onChange={(e) => handleModelSelect(e.target.value)}
              className="absolute opacity-0 top-0 left-0 w-full h-full cursor-pointer"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="o4-mini">GPT-4o Mini</option>
              <option value="gpt-4.1">GPT-4.1</option>
            </select>
          </div>

          {chatId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleToggleBookmark}>
                  {bookmarked ? (
                    <>
                      <Bookmark className="h-4 w-4 mr-2" /> Remove bookmark
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4 mr-2" /> Add bookmark
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRename}>
                  <Pencil className="h-4 w-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {diagnostics.running && (
            <div className="text-xs text-muted-foreground animate-pulse">
              Running diagnostics...
            </div>
          )}

          {diagnostics.results && (
            <div
              className={`px-2 py-1 rounded-md text-xs ${
                diagnostics.results.database?.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {diagnostics.results.database?.success ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>DB OK</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>DB Error</span>
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={runDiagnostics}
            disabled={diagnostics.running}
            title="Run diagnostics"
          >
            <Database className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
