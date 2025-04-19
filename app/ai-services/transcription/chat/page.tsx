"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  Share,
  MoreVertical,
  FileText,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import React from "react";
import Chat, { Message } from "@/components/ai-services/Chat";
import { Button } from "@/components/ui/button";
import { Microsoft365Resource } from "@/components/ai-services/ResourcePicker";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { chatHistoryService } from "@/services/chatHistoryService";

type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
  [key: string]: unknown;
};

type StoredTranscription = {
  transcriptionId: string;
  status: string;
  text: string;
  segments: TranscriptionSegment[];
  minuteSegments: Record<string, TranscriptionSegment[]>;
  [key: string]: unknown;
};

type ModelOption = "gpt-4o" | "o4-mini" | "gpt-4.1";

export default function TranscriptionChatPage() {
  const [documentTitle, setDocumentTitle] = useState("");
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedTranscription, setStoredTranscription] =
    useState<StoredTranscription | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>("gpt-4o");
  const [userId, setUserId] = useState<string>("");
  const [chatId, setChatId] = useState<string | null>(null);
  const { user } = useCurrentUser();

  // Get transcription ID and title from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const title = params.get("title") || "Transkripsjon";
    const userIdParam = params.get("userId");
    const historyChatId = params.get("chatId");

    if (!id) {
      console.error("No transcription ID found in URL");
      setError("No transcription ID found in URL");
      return;
    }

    setTranscriptionId(id);
    setDocumentTitle(decodeURIComponent(title));
    if (userIdParam) {
      setUserId(userIdParam);
    }

    // Check if we're loading an existing chat from history
    if (historyChatId) {
      setChatId(historyChatId);
      loadChatHistory(historyChatId);
    } else {
      // Continue with normal transcription loading
      loadTranscription(id);
    }
  }, []);

  // Load chat history if chat ID is provided
  const loadChatHistory = async (historyChatId: string) => {
    try {
      if (!user?.id) return;

      const chatHistory = await chatHistoryService.getChatById(historyChatId);

      if (chatHistory && chatHistory.user_id === user.id) {
        // Load chat data
        setMessages(chatHistory.content.messages);

        // Set transcription ID from thread_id
        if (chatHistory.thread_id) {
          setTranscriptionId(chatHistory.thread_id);

          // Also load the transcription data
          if (chatHistory.metadata?.transcriptionData) {
            setStoredTranscription(
              chatHistory.metadata.transcriptionData as StoredTranscription
            );
          } else {
            // Fall back to loading from localStorage
            loadTranscription(chatHistory.thread_id);
          }
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  // Load transcription data from localStorage or fallback to API
  const loadTranscription = (id: string) => {
    console.log("All localS");

    // Try to get the saved transcription from localStorage
    try {
      // First check with the exact key
      const exactKey = `transcription_${id}`;
      console.log("Looking for localStorage key:", exactKey);

      let savedTranscription = localStorage.getItem(exactKey);

      // If not found, try checking all keys that might contain the ID
      if (!savedTranscription) {
        console.log("Exact key not found, searching all keys...");
        const allKeys = Object.keys(localStorage);
        const matchingKeys = allKeys.filter((key) => key.includes(id));
        console.log("Matching keys:", matchingKeys);

        if (matchingKeys.length > 0) {
          savedTranscription = localStorage.getItem(matchingKeys[0]);
        }
      }

      if (savedTranscription) {
        try {
          const parsedTranscription = JSON.parse(savedTranscription);
          console.log("Found and parsed transcription in localStorage:", id);
          console.log("Transcription has text:", !!parsedTranscription.text);
          setStoredTranscription(parsedTranscription);
          setError(null);
        } catch (parseErr) {
          console.error(
            "Error parsing transcription from localStorage:",
            parseErr
          );
          setError("Error loading transcription data");
        }
      } else {
        console.log("No transcription found in localStorage");

        // Still check with server as backup
        fetch(`/api/ai-services/transcription/validate?id=${id}`)
          .then((response) => response.json())
          .then((data) => {
            if (!data.exists) {
              setError(
                "Transcription not found. It may have expired since the page was refreshed."
              );
            } else {
              setError(null);
            }
          })
          .catch((err) => {
            console.error("Error validating transcription:", err);
          });
      }
    } catch (err) {
      console.error("Error accessing localStorage:", err);
      // Fall back to server validation
      fetch(`/api/ai-services/transcription/validate?id=${id}`)
        .then((response) => response.json())
        .then((data) => {
          if (!data.exists) {
            setError(
              "Transcription not found. It may have expired since the page was refreshed."
            );
          } else {
            setError(null);
          }
        })
        .catch((err) => {
          console.error("Error validating transcription:", err);
        });
    }
  };

  // Save chat history to Supabase
  const saveChatHistory = async (messagesArray: Message[]) => {
    if (!user?.id || !transcriptionId) return null;

    try {
      const savedChatId = await chatHistoryService.saveChat(
        user.id,
        "transcription",
        messagesArray,
        documentTitle,
        transcriptionId,
        { transcriptionData: storedTranscription },
        chatId || undefined // Pass undefined instead of null
      );

      if (savedChatId && !chatId) {
        setChatId(savedChatId);
      }

      return savedChatId;
    } catch (error) {
      console.error("Error saving chat history:", error);
      return null;
    }
  };

  // Handle submitting a message
  const handleSubmit = async (
    message: string,
    attachments?: Microsoft365Resource[]
  ) => {
    if (!transcriptionId) {
      console.error("Cannot send message without transcription ID");
      return;
    }

    if (!message.trim() && (!attachments || attachments.length === 0)) return;

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: message,
      attachments,
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
      // Prepare messages array for API
      const messagesToSend = updatedMessages;

      // Make API request
      const response = await fetch("/api/ai-services/transcription/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesToSend,
          transcriptionId,
          storedTranscription,
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
      console.error("Error in chat:", error);
      setError("Failed to get response from chat service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle model selection
  const handleModelSelect = (model: ModelOption) => {
    setSelectedModel(model);
  };

  // Document Info Component
  const DocumentInfoComponent = () => {
    if (!storedTranscription) return null;

    return (
      <div className="w-full mb-8">
        <div className="bg-gray-50 border border-gray-100 rounded-md p-4 mb-4">
          <h2 className="text-lg font-medium text-gray-800 mb-2">
            {documentTitle}
          </h2>
          <p className="text-sm text-gray-600">
            Ask questions about this transcription
          </p>
        </div>
      </div>
    );
  };

  // Header Component
  const HeaderComponent = () => {
    const navigateToTranscriptionPage = () => {
      window.location.href = "/ai-services/transcription";
    };

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
            <button
              onClick={navigateToTranscriptionPage}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Transkribering
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Chat</span>
          </div>
        </div>

        {/* Header with document title and controls */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 mr-2"
              onClick={navigateToTranscriptionPage}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Tilbake</span>
            </Button>

            <div className="flex items-center">
              <FileText className="h-5 w-5 text-primary mr-2" />
              <h1 className="text-lg font-semibold">{documentTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  document.getElementById("model-dropdown")?.click()
                }
              >
                <span className="mr-1">{selectedModel}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <select
                id="model-dropdown"
                value={selectedModel}
                onChange={(e) =>
                  handleModelSelect(e.target.value as ModelOption)
                }
                className="absolute opacity-0 top-0 left-0 w-full h-full cursor-pointer"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="o4-mini">GPT-4o Mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
              </select>
            </div>

            <button className="text-gray-500 hover:text-gray-700 p-1 rounded flex items-center gap-1">
              <span className="text-sm">Share</span>
              <Share className="h-4 w-4" />
            </button>
            <button className="text-gray-500 hover:text-gray-700 p-1 rounded">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
    );
  };

  return (
    <Chat
      messages={messages}
      onSubmit={handleSubmit}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      error={error}
      infoComponent={<DocumentInfoComponent />}
      headerComponent={<HeaderComponent />}
      placeholder="Ask about the transcription..."
      userId={userId}
    />
  );
}
