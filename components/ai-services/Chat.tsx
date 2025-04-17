"use client";

import { useEffect, useRef, FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  Loader2,
  Send,
  Search,
  Plus,
  Paperclip,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ResourcePicker, { Microsoft365Resource } from "./ResourcePicker";
import AttachedResources from "./AttachedResources";
import { motion, AnimatePresence } from "framer-motion";

export type Message = {
  role: "user" | "assistant";
  content: string;
  attachments?: Microsoft365Resource[];
};

export interface ChatProps {
  messages: Message[];
  onSubmit: (
    message: string,
    attachments?: Microsoft365Resource[]
  ) => Promise<void>;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  infoComponent?: ReactNode;
  headerComponent?: ReactNode;
  assistantName?: string;
  disabled?: boolean;
  placeholder?: string;
  userId?: string;
}

export default function Chat({
  messages,
  onSubmit,
  input,
  setInput,
  isLoading,
  error,
  infoComponent,
  headerComponent,
  assistantName = "Assistant",
  disabled = false,
  placeholder = "Ask anything...",
  userId = "",
}: ChatProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedResources, setAttachedResources] = useState<
    Microsoft365Resource[]
  >([]);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);

  // Scroll to bottom of messages when new ones come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input field when loaded
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle submitting a message
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedResources.length === 0) return;

    await onSubmit(input, attachedResources);

    // Clear attachments after sending
    setAttachedResources([]);
  };

  // Handle selecting resources from the picker
  const handleSelectResources = (resources: Microsoft365Resource[]) => {
    setAttachedResources((prev) => [...prev, ...resources]);
  };

  // Handle removing an attached resource
  const handleRemoveResource = (resourceId: string) => {
    setAttachedResources((prev) =>
      prev.filter((resource) => resource.id !== resourceId)
    );
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background">
      {/* Header */}
      {headerComponent}

      <main className="flex-1 overflow-y-auto p-4">
        {/* Display error message if any */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-5xl mx-auto px-4 py-4">
            {/* Info component - only shown initially */}
            {messages.length <= 1 && !error && infoComponent}

            <div className="space-y-10">
              {messages.map((message, index) => (
                <div key={index} className="w-full">
                  {message.role === "user" ? (
                    <div className="flex justify-end mb-2">
                      <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-gray-800 max-w-[80%] shadow-sm">
                        {message.attachments &&
                          message.attachments.length > 0 && (
                            <AttachedResources
                              resources={message.attachments}
                              className="mb-3"
                              readonly
                            />
                          )}
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="mb-2 text-sm text-gray-500 px-1">
                        {assistantName}
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
                                code: ({ className, children, ...props }) => {
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

        {/* Input area with attachment support */}
        <div className="border-t bg-white py-3 w-full">
          <div className="max-w-5xl mx-auto px-4">
            {/* Attached resources display */}
            <AnimatePresence>
              {attachedResources.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3"
                >
                  <AttachedResources
                    resources={attachedResources}
                    onRemove={handleRemoveResource}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                className="w-full py-3 px-4 pr-24 border rounded-full shadow-sm focus:ring-1 focus:ring-gray-300"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={disabled || isLoading}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setIsResourcePickerOpen(true)}
                  disabled={disabled || isLoading}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
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
                    (!input.trim() && attachedResources.length === 0) ||
                    disabled ||
                    isLoading
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
                AI assistants may produce inaccurate information.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Resource Picker Dialog */}
      <ResourcePicker
        open={isResourcePickerOpen}
        onOpenChange={setIsResourcePickerOpen}
        onSelectResources={handleSelectResources}
        userId={userId}
      />
    </div>
  );
}
