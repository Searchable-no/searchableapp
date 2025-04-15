"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  FileText,
  X,
  MoreVertical,
  Share,
  HelpCircle,
  Loader2,
  AlertCircle,
  Send,
  Menu,
  Plus,
  Search,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function TranscriptionChatPage() {
  const [documentTitle, setDocumentTitle] = useState("");
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedTranscription, setStoredTranscription] = useState<{
    transcriptionId: string;
    status: string;
    text: string;
    segments?: any[];
    minuteSegments?: any[];
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages when new ones come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Get transcription ID and title from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const title = params.get("title") || "Transkripsjon";

    if (!id) {
      console.error("No transcription ID found in URL");
      setError("No transcription ID found in URL");
      return;
    }

    setTranscriptionId(id);
    setDocumentTitle(decodeURIComponent(title));

    // Debug - check all localStorage keys
    console.log("All localStorage keys:", Object.keys(localStorage));

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

  // Focus input field when loaded
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Remove document from context (UI functionality only)
  const removeDocument = () => {
    console.log("Document removed from context (UI only)");
  };

  // Handle submitting a message
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!transcriptionId) {
      console.error("Cannot send message without transcription ID");
      return;
    }

    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { role: "user" as const, content: input };
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

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header - updated to match the image */}
      <header className="flex items-center justify-between px-4 py-2 border-b shadow-sm">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-700 flex items-center">
            <span className="mr-1">TranscriptionGPT</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-gray-500 hover:text-gray-700 p-1 rounded flex items-center gap-1">
            <span className="text-sm">Share</span>
            <Share className="h-4 w-4" />
          </button>
          <button className="text-gray-500 hover:text-gray-700 p-1 rounded">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* Error message */}
          {error && (
            <div className="w-full px-4 pt-4">
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-4 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Transcription Error</p>
                  <p className="text-xs">{error}</p>
                  <p className="text-xs mt-1">
                    Try returning to the transcription page and opening the chat
                    again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto w-full">
            <div className="max-w-5xl mx-auto px-4 py-4">
              {/* Document info - only shown initially */}
              {messages.length === 0 && !error && (
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
              )}

              <div className="space-y-10">
                {messages.map((message, index) => (
                  <div key={index} className="w-full">
                    {message.role === "user" ? (
                      <div className="flex justify-end mb-2">
                        <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-gray-800 max-w-[80%] shadow-sm">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className="mb-2 text-sm text-gray-500 px-1">
                          TranscriptionGPT
                        </div>
                        <div className="bg-white border border-gray-100 rounded-md px-4 py-3 text-gray-800 shadow-sm pb-6">
                          {message.content ? (
                            <div className="prose prose-sm max-w-none text-gray-800">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Style headers
                                  h1: ({ ...props }) => (
                                    <h1
                                      className="text-xl font-bold mt-6 mb-3"
                                      {...props}
                                    />
                                  ),
                                  h2: ({ ...props }) => (
                                    <h2
                                      className="text-lg font-semibold mt-5 mb-3"
                                      {...props}
                                    />
                                  ),
                                  h3: ({ ...props }) => (
                                    <h3
                                      className="text-lg font-semibold mt-5 mb-3"
                                      {...props}
                                    />
                                  ),
                                  h4: ({ ...props }) => (
                                    <h4
                                      className="text-base font-semibold mt-4 mb-2"
                                      {...props}
                                    />
                                  ),

                                  // Style paragraphs
                                  p: ({ ...props }) => (
                                    <p className="my-2" {...props} />
                                  ),

                                  // Style lists
                                  ul: ({ ...props }) => (
                                    <ul className="my-2 ml-2" {...props} />
                                  ),
                                  ol: ({ ...props }) => (
                                    <ol className="my-2 ml-2" {...props} />
                                  ),
                                  li: ({ children, ...props }) => {
                                    return (
                                      <li className="my-1 ml-2" {...props}>
                                        {children}
                                      </li>
                                    );
                                  },

                                  // Style tables
                                  table: ({ ...props }) => (
                                    <div className="my-4 overflow-x-auto">
                                      <table
                                        className="min-w-full divide-y divide-gray-200 border border-gray-200"
                                        {...props}
                                      />
                                    </div>
                                  ),
                                  thead: ({ ...props }) => (
                                    <thead className="bg-gray-50" {...props} />
                                  ),
                                  tbody: ({ ...props }) => (
                                    <tbody
                                      className="bg-white divide-y divide-gray-200"
                                      {...props}
                                    />
                                  ),
                                  tr: ({ ...props }) => (
                                    <tr
                                      className="border-b border-gray-200"
                                      {...props}
                                    />
                                  ),
                                  th: ({ ...props }) => (
                                    <th
                                      className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                                      {...props}
                                    />
                                  ),
                                  td: ({ ...props }) => (
                                    <td
                                      className="px-3 py-2 text-sm text-gray-700 border-r border-gray-200 last:border-r-0"
                                      {...props}
                                    />
                                  ),

                                  // Style code blocks
                                  code: ({
                                    className,
                                    children,
                                    ...props
                                  }: any) => {
                                    const match = /language-(\w+)/.exec(
                                      className || ""
                                    );
                                    return className?.includes("inline") ? (
                                      <code
                                        className="px-1 py-0.5 bg-gray-100 rounded text-sm"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    ) : (
                                      <pre className="p-3 bg-gray-50 rounded-md overflow-auto text-sm my-3">
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    );
                                  },
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : isLoading ? (
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-1"></div>
                              <div
                                className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-1"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                                style={{ animationDelay: "0.4s" }}
                              ></div>
                            </div>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area - updated to match image */}
          <div className="border-t bg-white py-3 w-full">
            <div className="max-w-5xl mx-auto px-4">
              <form onSubmit={handleSubmit} className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask anything"
                  className="w-full py-3 px-4 pr-24 border rounded-full shadow-sm focus:ring-1 focus:ring-gray-300"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!transcriptionId || isLoading || error !== null}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <Button
                    type="submit"
                    className="rounded-full h-7 w-7 p-0 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors"
                    disabled={
                      !input.trim() ||
                      !transcriptionId ||
                      isLoading ||
                      error !== null
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    ) : (
                      <Send className="h-3 w-3 text-white" />
                    )}
                  </Button>
                </div>
              </form>
              <div className="flex justify-between mt-3 text-xs text-gray-500">
                <div className="flex items-center space-x-2">
                  <button className="p-1">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-center">
                  Transcription Assistant may produce inaccurate information.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
