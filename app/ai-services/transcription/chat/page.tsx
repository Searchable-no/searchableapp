"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Share, MoreVertical, FileText } from "lucide-react";
import React from "react";
import Chat, { Message } from "@/components/ai-services/Chat";
import { Button } from "@/components/ui/button";
import { Microsoft365Resource } from "@/components/ai-services/ResourcePicker";

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

  // Get transcription ID and title from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const title = params.get("title") || "Transkripsjon";
    const userIdParam = params.get("userId");

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

    // Debug - check all localStorage keys
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
  }, []);

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
    setMessages((prev) => [...prev, userMessage]);

    // Clear input field
    setInput("");

    // Start loading state
    setIsLoading(true);

    try {
      // Prepare messages array for API
      const messagesToSend = [...messages, userMessage];

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
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        assistantMessage += chunk;

        // Update the assistant message with what we've received so far
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: assistantMessage,
          };
          return newMessages;
        });
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
  const HeaderComponent = () => (
    <header className="flex items-center justify-between px-4 py-2 border-b shadow-sm">
      <div className="flex items-center gap-2">
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
            onClick={() => document.getElementById("model-dropdown")?.click()}
          >
            <span className="mr-1">{selectedModel}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <select
            id="model-dropdown"
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value as ModelOption)}
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
    </header>
  );

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
      assistantName="AI Transcription Assistant"
      placeholder="Ask about the transcription..."
      userId={userId}
    />
  );
}
