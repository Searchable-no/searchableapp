"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Message } from "@/components/ai-services/Chat";
import Chat from "@/components/ai-services/Chat";
import { chatHistoryService } from "@/services/chatHistoryService";
import { ChevronRight } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

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
      }

      return savedChatId;
    } catch (error) {
      debug("Error saving chat history:", error);
      return null;
    }
  };

  // Handle submitting a message
  const handleSubmit = async (message: string) => {
    if (!message.trim()) return;

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: message,
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
      // Make API request
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
        saveChatHistory(finalMessages);
      }
    } catch (error) {
      debug("Error in chat:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 border-b">
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
  );
}
