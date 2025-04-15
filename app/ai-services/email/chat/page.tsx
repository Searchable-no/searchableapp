"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  Mail,
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
import { EmailMessage } from "@/lib/microsoft-graph";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function EmailChatPage() {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailId, setEmailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedEmail, setStoredEmail] = useState<EmailMessage | null>(null);
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

  // Get email ID and subject from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const subject = params.get("subject") || "E-post";

    if (!id) {
      console.error("No email ID found in URL");
      setError("No email ID found in URL");
      return;
    }

    setEmailId(id);
    setEmailSubject(decodeURIComponent(subject));

    console.log("Loading email with ID:", id);

    // Try to get the saved email from localStorage
    try {
      const emailKey = `email_${id}`;
      const savedEmail = localStorage.getItem(emailKey);

      console.log("Email in localStorage:", savedEmail ? "Found" : "Not found");

      if (savedEmail) {
        try {
          const parsedEmail = JSON.parse(savedEmail);
          console.log("Parsed email from localStorage:", {
            id: parsedEmail.id,
            subject: parsedEmail.subject,
            from:
              parsedEmail.from?.emailAddress?.name ||
              parsedEmail.from?.emailAddress?.address,
          });

          setStoredEmail(parsedEmail);
          setError(null);

          // Add initial assistant message about the email
          setMessages([
            {
              role: "assistant",
              content: `Jeg er klar til å hjelpe deg med e-posten med emne "${decodeURIComponent(
                subject
              )}". Hva ønsker du hjelp med?`,
            },
          ]);
        } catch (parseErr) {
          console.error("Error parsing email from localStorage:", parseErr);
          setError("Error loading email data - invalid format");
        }
      } else {
        // If not found in localStorage, check if we can reach the API
        console.log(
          "Email not found in localStorage, checking API connectivity"
        );

        fetch("/api/ai-services/email/chat/health", {
          method: "GET",
          credentials: "include",
        })
          .then((response) => {
            console.log("API health check response:", response.status);
            if (response.ok) {
              setError(
                "Email not found. It may have expired or was never saved correctly. API is accessible."
              );
            } else {
              setError(
                `Email not found. API returned status ${response.status}`
              );
            }
          })
          .catch((error) => {
            console.error("API health check failed:", error);
            setError(
              "Email not found and API connectivity check failed. Please try again."
            );
          });
      }
    } catch (err) {
      console.error("Error accessing localStorage:", err);
      setError("Error accessing stored email data");
    }
  }, []);

  // Focus input field when loaded
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle submitting a message
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!emailId || !storedEmail) {
      console.error("Cannot send message without email ID or data");
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
      const response = await fetch("/api/ai-services/email/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          messages: messagesToSend,
          emailId,
          storedEmail,
        }),
      });

      // Log status for debugging
      console.log(`Chat API Response status: ${response.status}`);

      if (!response.ok) {
        // Handle authentication errors specifically
        if (response.status === 401) {
          setError(
            "Authentication error. Please refresh the page or try logging in again."
          );
          console.error("Authentication error with the chat API");

          // Show a more helpful message if we can parse the error
          try {
            const errorData = await response.json();
            console.error("Chat API Auth Error:", errorData);
            throw new Error(errorData.error || "Authentication required");
          } catch (jsonError) {
            throw new Error("Authentication error. Please try again.");
          }
        } else {
          // Try to get more detailed error information for other errors
          try {
            const errorData = await response.json();
            console.error("Chat API Error Details:", errorData);
            throw new Error(
              errorData.error ||
                `Error ${response.status}: ${response.statusText}`
            );
          } catch (jsonError) {
            console.error("Failed to parse error response:", jsonError);
            throw new Error(
              `Error communicating with chat API: ${response.status}`
            );
          }
        }
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b shadow-sm">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-700 flex items-center">
            <span className="mr-1">EmailGPT</span>
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
                  <p className="text-sm font-medium">Email Error</p>
                  <p className="text-xs">{error}</p>
                  <p className="text-xs mt-1">
                    Try returning to the email page and opening the chat again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto w-full">
            <div className="max-w-5xl mx-auto px-4 py-4">
              {/* Email info - only shown initially */}
              {messages.length <= 1 && !error && storedEmail && (
                <div className="w-full mb-8">
                  <div className="bg-gray-50 border border-gray-100 rounded-md p-4 mb-4">
                    <h2 className="text-lg font-medium text-gray-800 mb-2">
                      {emailSubject}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Mail className="h-3 w-3" />
                      <span>
                        {storedEmail.from?.emailAddress?.name ||
                          storedEmail.from?.emailAddress?.address ||
                          "Unknown Sender"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 border-t pt-3">
                      {storedEmail.bodyPreview || "No preview available"}
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
                          EmailGPT
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

          {/* Input area */}
          <div className="border-t bg-white py-3 w-full">
            <div className="max-w-5xl mx-auto px-4">
              <form onSubmit={handleSubmit} className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Spør om hjelp med e-postsvar..."
                  className="w-full py-3 px-4 pr-24 border rounded-full shadow-sm focus:ring-1 focus:ring-gray-300"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={
                    !emailId || isLoading || error !== null || !storedEmail
                  }
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
                      !emailId ||
                      isLoading ||
                      error !== null ||
                      !storedEmail
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
                  Email Assistant may produce inaccurate information.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
