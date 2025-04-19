"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Message } from "@/components/ai-services/Chat";
import Chat from "@/components/ai-services/Chat";
import { Microsoft365Resource } from "@/components/ai-services/ResourcePicker";
import { chatHistoryService } from "@/services/chatHistoryService";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  MessageSquare,
  FileText,
  Mail,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatHistory, ChatType } from "@/types/chat";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase-browser";

// Debug helper
const DEBUG = true;
const debug = (...args: any[]) => {
  if (DEBUG) console.log("[ChatDebug]", ...args);
};

export default function GeneralChatPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Start with welcome message
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Velkommen til chatten. Hva kan jeg hjelpe deg med i dag?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("New Chat");
  const [selectedModel] = useState("gpt-4o");
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Chat history sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedThreads, setExpandedThreads] = useState<
    Record<string, boolean>
  >({});
  const [selectedType, setSelectedType] = useState<ChatType | "all">("all");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoadAttempts, setHistoryLoadAttempts] = useState(0);

  // Check if screen is mobile size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Load chat history for the sidebar
  useEffect(() => {
    let retryCount = 0;
    let pollingInterval: NodeJS.Timeout | null = null;
    const maxRetries = 5;
    let directUserId: string | null = null;

    // Direktesjekk av bruker via Supabase
    const checkSupabaseSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          directUserId = session.user.id;
          debug("Supabase session check successful, user ID:", directUserId);
          return true;
        } else {
          debug("Supabase session check: No active session");
          return false;
        }
      } catch (error) {
        debug("Error checking Supabase session:", error);
        return false;
      }
    };

    const loadAllChatHistory = async () => {
      // Prøv å bruke user fra useCurrentUser først
      let userId = user?.id;

      // Hvis useCurrentUser ikke er klar ennå, sjekk direkte via Supabase
      if (!userId) {
        if (directUserId) {
          userId = directUserId;
          debug("Using direct user ID from Supabase session:", userId);
        } else {
          const hasSession = await checkSupabaseSession();
          if (hasSession && directUserId) {
            userId = directUserId;
            debug("Obtained user ID directly from Supabase:", userId);
          }
        }
      }

      if (!userId) {
        debug("Cannot load chat history: user not loaded or not authenticated");
        return false; // Loading not successful
      }

      setIsLoadingHistory(true);
      setHistoryLoadAttempts((prev) => prev + 1);

      try {
        debug(
          `Loading chat history attempt #${retryCount + 1}, user ID:`,
          userId
        );
        const type =
          selectedType !== "all" ? (selectedType as ChatType) : undefined;
        debug("Loading chat history for sidebar:", "type:", type || "all");
        const history = await chatHistoryService.getUserChats(userId, type);

        debug("Loaded chat history for sidebar:", history.length, "items");

        // Validate each chat history item
        const validHistory = history.filter((chat) => {
          if (!chat.content || !Array.isArray(chat.content.messages)) {
            debug("Invalid chat structure:", chat.id);
            return false;
          }
          return true;
        });

        if (validHistory.length !== history.length) {
          debug(
            `Filtered out ${history.length - validHistory.length} invalid chats`
          );
        }

        setChatHistory(validHistory);
        debug("Chat history loaded successfully");
        setIsLoadingHistory(false);
        return true; // Loading successful
      } catch (error) {
        debug("Error loading chat history for sidebar:", error);
        setIsLoadingHistory(false);
        return false; // Loading not successful
      }
    };

    const attemptLoadWithRetry = async () => {
      const success = await loadAllChatHistory();

      // If loading was successful or we've reached max retries, stop polling
      if (success || retryCount >= maxRetries) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }

        if (!success && retryCount >= maxRetries) {
          debug(`Failed to load chat history after ${maxRetries} attempts`);
        }
      }

      retryCount++;
    };

    // Start initialization process
    const initChatHistory = async () => {
      // Try to get user directly from Supabase first
      await checkSupabaseSession();

      // Start polling immediately
      debug("Starting polling to load chat history");
      attemptLoadWithRetry();

      // Set up polling every 1 second
      pollingInterval = setInterval(attemptLoadWithRetry, 1000);
    };

    // Kick off the initialization
    initChatHistory();

    // Add window focus event listener to reload history when tab regains focus
    const handleFocus = () => {
      debug("Window focused, reloading chat history");
      loadAllChatHistory();
    };

    // Also trigger on visibility change (when tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        debug("Tab became visible, reloading chat history");
        loadAllChatHistory();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, userLoading, selectedType]);

  // Initial setup - check URL and localStorage
  useEffect(() => {
    const urlChatId = searchParams.get("chatId");
    const storedChatId = localStorage.getItem("selectedChatId");
    const fromHistory = localStorage.getItem("fromChatHistory") === "true";

    debug("Initial load:", {
      urlChatId,
      storedChatId,
      fromHistory,
      userLoaded: !!user?.id,
    });

    // Clear localStorage flags if we used them
    if (fromHistory) {
      localStorage.removeItem("fromChatHistory");
      localStorage.removeItem("selectedChatId");
    }

    // Determine which chatId to use (URL > localStorage > none)
    const chatIdToUse = urlChatId || (fromHistory ? storedChatId : null);
    if (chatIdToUse) {
      debug("Setting chatId:", chatIdToUse);
      setChatId(chatIdToUse);

      // Update URL if needed
      if (fromHistory && storedChatId && !urlChatId) {
        const newUrl = `${window.location.pathname}?chatId=${storedChatId}`;
        debug("Updating URL to include chatId:", newUrl);
        router.replace(newUrl);
      }
    }
  }, []);

  // Load chat history when user and chatId are available
  useEffect(() => {
    if (chatId && !userLoading && user?.id && !loadAttempted) {
      debug("User loaded and chatId available, loading history:", chatId);
      setLoadAttempted(true); // Prevent repeated load attempts
      loadChatHistory(chatId);
    }
  }, [user, userLoading, chatId, loadAttempted]);

  // Create new chat
  const handleNewChat = () => {
    setChatId(null);
    setMessages([
      {
        role: "assistant",
        content: "Velkommen til en ny chat. Hva kan jeg hjelpe deg med i dag?",
      },
    ]);
    setChatTitle("New Chat");
    setLoadAttempted(false);
    // Update URL to remove chatId
    router.push("/ai-services/chat");
  };

  // Select chat from history
  const handleSelectChat = (selectedChatId: string) => {
    if (selectedChatId === chatId) return; // Already selected

    setChatId(selectedChatId);
    setLoadAttempted(false);
    router.push(`/ai-services/chat?chatId=${selectedChatId}`);
  };

  // Toggle thread expansion
  const toggleThreadExpansion = (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedThreads((prev) => ({
      ...prev,
      [threadId]: !prev[threadId],
    }));
  };

  // Function to get the appropriate link for chat type
  const getChatLink = (chat: ChatHistory) => {
    // Ensure chat has an ID
    if (!chat.id) {
      debug("Missing chat ID for chat:", chat);
      return "/ai-services/chat"; // Fallback to chat page
    }

    // Check if the chat content is valid
    if (!chat.content || !Array.isArray(chat.content.messages)) {
      debug("Invalid chat content structure for chat ID:", chat.id);
      // Return just the chat ID as fallback to avoid errors
      return `/ai-services/chat?chatId=${chat.id}`;
    }

    // Ensure we always have a valid chat ID in the URL
    const chatIdParam = `chatId=${chat.id}`;

    switch (chat.type) {
      case "transcription":
        return `/ai-services/transcription/chat?${chatIdParam}${chat.thread_id ? `&id=${chat.thread_id}` : ""}`;
      case "email":
        // Check if this is an email thread or single email from metadata
        if (chat.metadata?.isEmailThread) {
          return `/ai-services/email/chat?${chatIdParam}${chat.thread_id ? `&threadId=${chat.thread_id}` : ""}&subject=${encodeURIComponent(chat.title)}`;
        } else {
          return `/ai-services/email/chat?${chatIdParam}${chat.thread_id ? `&id=${chat.thread_id}` : ""}&subject=${encodeURIComponent(chat.title)}`;
        }
      case "normal":
        return `/ai-services/chat?${chatIdParam}`;
      default:
        return `/ai-services/chat?${chatIdParam}`;
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

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return format(parseISO(dateString), "dd.MM.yyyy HH:mm");
    } catch {
      return dateString;
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

  // Group chats by thread_id for sidebar display
  const groupedChats = useMemo(() => {
    const groups: Record<string, ChatHistory[]> = {};
    const standalone: ChatHistory[] = [];

    // Filter chats based on search query
    const filteredChats = searchQuery
      ? chatHistory.filter((chat) =>
          chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : chatHistory;

    // First group conversations by thread_id
    filteredChats.forEach((chat) => {
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
  }, [chatHistory, searchQuery]);

  // Render a chat item for the sidebar
  const renderChatItem = (chat: ChatHistory) => {
    // Skip rendering if chat doesn't have required properties
    if (!chat.id || !chat.content || !Array.isArray(chat.content.messages)) {
      debug("Invalid chat object:", chat);
      return null;
    }

    return (
      <div className="flex justify-between items-start">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => chat.id && handleSelectChat(chat.id)}
        >
          <div className="flex items-center gap-2 mb-2">
            {getChatIcon(chat.type)}
            <h3 className="font-medium text-xs">{chat.title}</h3>
            <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
              {getTypeName(chat.type)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {getChatPreview(chat)}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-[10px]">{formatDate(chat.updated_at)}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            chat.id && deleteChat(chat.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  // Delete a chat
  const deleteChat = async (chatId: string) => {
    if (confirm("Er du sikker på at du vil slette denne samtalen?")) {
      const success = await chatHistoryService.deleteChat(chatId);
      if (success) {
        setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));

        // If we deleted the current chat, reset state
        if (chatId === chatId) {
          handleNewChat();
        }
      }
    }
  };

  // Filtered chat history based on search
  const filteredChatHistory = searchQuery
    ? chatHistory.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chatHistory;

  // Format timestamp for chat history items
  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Load chat history
  const loadChatHistory = async (historyChatId: string) => {
    try {
      if (!user?.id) {
        debug("Cannot load chat history: User not logged in");
        return;
      }

      debug("Loading chat history:", historyChatId);
      setIsLoading(true);

      const chatHistory = await chatHistoryService.getChatById(historyChatId);

      debug("Chat history response received, has data:", !!chatHistory);

      if (!chatHistory) {
        debug("Chat history not found for ID:", historyChatId);
        setError("Chat ikke funnet");
        return;
      }

      if (chatHistory.user_id !== user.id) {
        debug("Chat history not owned by this user");
        setError("Du har ikke tilgang til denne chatten");
        return;
      }

      // Validate chat content structure
      if (
        !chatHistory.content ||
        !Array.isArray(chatHistory.content.messages)
      ) {
        debug("Invalid chat content structure:", chatHistory.content);
        setError("Ugyldig chathistorikk-struktur");
        return;
      }

      // Validate and map messages
      const validMessages = chatHistory.content.messages
        .filter(
          (msg) =>
            msg && typeof msg === "object" && "role" in msg && "content" in msg
        )
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content as string,
          attachments: msg.attachments || undefined,
        }));

      debug("Valid messages found:", validMessages.length);

      if (validMessages.length === 0) {
        debug("No valid messages in chat history");
        setError("Ingen gyldige meldinger i chathistorikken");
        return;
      }

      // Set messages and title
      setMessages(validMessages);
      setChatTitle(chatHistory.title || "Chat");

      // Remove welcome message
      debug("Chat loaded successfully!");
    } catch (error) {
      debug("Error loading chat history:", error);
      setError(
        "Kunne ikke laste chathistorikk: " +
          (error instanceof Error ? error.message : "Ukjent feil")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Save chat history to Supabase
  const saveChatHistory = async (messagesArray: Message[]) => {
    if (!user?.id) return null;

    try {
      debug("Saving chat history...");
      // For title, use the first few words of the first user message
      const firstUserMessage = messagesArray.find((m) => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.split(" ").slice(0, 5).join(" ") + "..."
        : "New Chat";

      if (title !== chatTitle) {
        setChatTitle(title);
      }

      const savedChatId = await chatHistoryService.saveChat(
        user.id,
        "normal",
        messagesArray,
        title,
        undefined, // No thread_id for general chat
        {}, // No specific metadata
        chatId || undefined
      );

      if (savedChatId && !chatId) {
        debug("New chat saved with ID:", savedChatId);
        setChatId(savedChatId);
        // Update URL without refreshing the page
        const newUrl = `${window.location.pathname}?chatId=${savedChatId}`;
        window.history.pushState({ path: newUrl }, "", newUrl);

        // Reload chat history for sidebar
        const history = await chatHistoryService.getUserChats(user.id);
        setChatHistory(history);
      }

      return savedChatId;
    } catch (error) {
      debug("Error saving chat history:", error);
      return null;
    }
  };

  // Handle submitting a message
  const handleSubmit = async (
    message: string,
    attachments?: Microsoft365Resource[]
  ) => {
    if (!message.trim() && (!attachments || attachments.length === 0)) return;

    console.log(
      `Submitting message with ${attachments?.length || 0} attachments`
    );
    if (attachments && attachments.length > 0) {
      debug(`Attachment details:`);
      attachments.forEach((attachment, idx) => {
        debug(
          `- Attachment ${idx + 1}: type=${attachment.type}, name=${attachment.name || attachment.subject}, has content=${!!attachment.content}`
        );
      });
    }

    // Add user message to chat with attachments if present
    const userMessage: Message = {
      role: "user",
      content: message,
      attachments: attachments,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Save chat history with user message
    if (user?.id) {
      saveChatHistory(updatedMessages);
    }

    // Clear input field
    setInput("");

    // Start loading state
    setIsLoading(true);

    try {
      // Make API request - include attachments in the messages
      const response = await fetch("/api/ai-services/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error communicating with chat API");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get response reader");

      let assistantMessage = "";

      // Create a placeholder for the streaming message
      const messagesWithPlaceholder = [
        ...updatedMessages,
        { role: "assistant" as const, content: "" },
      ];
      setMessages(messagesWithPlaceholder);

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        assistantMessage += chunk;

        // Update the assistant message with what we've received so far
        const updatedMessagesWithAssistant = [
          ...updatedMessages,
          {
            role: "assistant" as const,
            content: assistantMessage,
          },
        ];

        setMessages(updatedMessagesWithAssistant);
      }

      // Save the complete conversation to chat history
      const finalMessages = [
        ...updatedMessages,
        {
          role: "assistant" as const,
          content: assistantMessage,
        },
      ];

      if (user?.id) {
        const savedId = await saveChatHistory(finalMessages);
        if (savedId) {
          // Refresh chat history to include this new chat
          const history = await chatHistoryService.getUserChats(user.id);
          setChatHistory(history);
        }
      }
    } catch (error) {
      debug("Error in chat:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Modern Chat History Sidebar */}
      <div
        className={cn(
          "border-r border-gray-100 flex-shrink-0 h-full flex flex-col transition-all duration-300 ease-in-out",
          isMobile ? "absolute z-10 bg-white h-full" : "relative",
          sidebarOpen
            ? "w-64"
            : isMobile
              ? "-translate-x-full w-64"
              : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <div className="relative w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats"
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-gray-50 rounded-md border-0 focus:ring-1 focus:ring-gray-200 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100"
              onClick={async () => {
                let userId = user?.id;
                if (!userId) {
                  // Try to get user from Supabase directly
                  try {
                    const {
                      data: { session },
                    } = await supabase.auth.getSession();
                    if (session?.user) {
                      userId = session.user.id;
                    }
                  } catch (error) {
                    debug("Error getting session:", error);
                  }
                }

                if (userId) {
                  debug("Manual refresh of chat history triggered");
                  chatHistoryService
                    .getUserChats(
                      userId,
                      selectedType !== "all"
                        ? (selectedType as ChatType)
                        : undefined
                    )
                    .then((history) => {
                      // Validate history items
                      const validHistory = history.filter((chat) => {
                        if (
                          !chat.content ||
                          !Array.isArray(chat.content.messages)
                        ) {
                          debug("Invalid chat structure:", chat.id);
                          return false;
                        }
                        return true;
                      });
                      setChatHistory(validHistory);
                      debug(
                        "Chat history refreshed manually:",
                        validHistory.length,
                        "items"
                      );
                    })
                    .catch((error) =>
                      debug("Error manually refreshing chat history:", error)
                    );
                } else {
                  debug("Cannot refresh: No user ID available");
                }
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M8 16H3v5"></path>
              </svg>
            </button>
            {isMobile && (
              <button
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100"
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat filter buttons */}
        <div className="p-2 border-b border-gray-100 flex space-x-1">
          <button
            className={cn(
              "text-xs py-1 px-2 rounded-md flex-1",
              selectedType === "all"
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => setSelectedType("all")}
          >
            Alle
          </button>
          <button
            className={cn(
              "text-xs py-1 px-2 rounded-md flex-1",
              selectedType === "normal"
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => setSelectedType("normal")}
          >
            Chat
          </button>
          <button
            className={cn(
              "text-xs py-1 px-2 rounded-md flex-1",
              selectedType === "email"
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            )}
            onClick={() => setSelectedType("email")}
          >
            E-post
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <button
              onClick={handleNewChat}
              className="w-full justify-start mb-3 text-xs font-normal text-gray-600 hover:bg-gray-50 rounded-md px-2.5 py-1.5 flex items-center"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              New Chat
            </button>

            {isLoadingHistory && (
              <div className="flex items-center justify-center py-2 mb-2 border border-gray-100 rounded-md bg-gray-50">
                <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                <span className="text-xs text-gray-500">
                  Laster historikk
                  {historyLoadAttempts > 1
                    ? ` (forsøk ${historyLoadAttempts})`
                    : ""}
                  ...
                </span>
              </div>
            )}

            {isLoading && chatHistory.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredChatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => chat.id && handleSelectChat(chat.id)}
                    className={cn(
                      "px-2.5 py-2 rounded-md cursor-pointer transition-colors flex items-center gap-2 group",
                      chatId === chat.id
                        ? "bg-gray-100 text-gray-900"
                        : "hover:bg-gray-50 text-gray-600"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                        chatId === chat.id ? "bg-gray-200" : "bg-gray-50"
                      )}
                    >
                      {getChatIcon(chat.type)}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="text-xs font-medium truncate">
                        {chat.title}
                      </span>
                      <span className="text-[10px] text-gray-400 opacity-60 group-hover:opacity-100">
                        {formatTimestamp(chat.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}

                {filteredChatHistory.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-xs text-gray-400">
                    {searchQuery
                      ? "Ingen samtaler samsvarer med søket"
                      : "Ingen tidligere samtaler"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header with back button on mobile */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 border-b">
          {!sidebarOpen ? (
            <button
              className="h-8 w-8 mr-1 flex items-center justify-center rounded-full hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              title="Vis chathistorikk"
            >
              <div className="w-4 h-4 flex flex-col justify-center space-y-0.5">
                <span className="w-4 h-0.5 bg-gray-600 block"></span>
                <span className="w-3 h-0.5 bg-gray-600 block"></span>
                <span className="w-4 h-0.5 bg-gray-600 block"></span>
              </div>
            </button>
          ) : (
            <button
              className="h-8 w-8 mr-1 flex items-center justify-center rounded-full hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
              title="Skjul chathistorikk"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <a
            href="/ai-services"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            AI Tjenester
          </a>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{chatTitle}</span>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Chat
            messages={messages}
            onSubmit={handleSubmit}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            error={error}
            placeholder="Spør om hva som helst..."
          />
        </div>
      </div>
    </div>
  );
}
