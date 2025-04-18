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
  Reply,
  Copy,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ResourcePicker, { Microsoft365Resource } from "./ResourcePicker";
import AttachedResources from "./AttachedResources";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Message = {
  role: "user" | "assistant";
  content: string;
  attachments?: Microsoft365Resource[];
};

// Interface for reply response
interface OutlookRedirectAction {
  type: "outlook_redirect";
  url: string;
  message: string;
  content: string;
  emailInfo?: {
    subject?: string;
    recipient?: string;
  };
}

interface ReplyResponse {
  success: boolean;
  action?: OutlookRedirectAction;
  message?: string;
  error?: string;
}

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
  emailId?: string;
  threadId?: string;
  onSendReply?: (content: string) => Promise<ReplyResponse | void>;
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
  emailId,
  threadId,
  onSendReply,
}: ChatProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedResources, setAttachedResources] = useState<
    Microsoft365Resource[]
  >([]);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [showReplyPreview, setShowReplyPreview] = useState(false);
  const [replyPreviewContent, setReplyPreviewContent] = useState("");
  const [replyUrl, setReplyUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");

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

  // Handle sending a reply
  const handleSendReply = async (content: string) => {
    console.log("handleSendReply called with: ", {
      emailId: emailId,
      threadId: threadId,
      contentLength: content?.length || 0,
      hasContent: !!content?.trim(),
      onSendReply: !!onSendReply,
    });

    // Sjekk om vi har alle nødvendige data
    if (!emailId && !threadId) {
      console.error("Cannot send reply - missing both emailId and threadId");
      return;
    }

    if (!content?.trim()) {
      console.error("Cannot send reply - content is empty");
      return;
    }

    if (!onSendReply) {
      console.error("Cannot send reply - onSendReply function not provided");
      return;
    }

    setIsSendingReply(true);
    setReplySuccess(false);
    setReplyError(null);

    try {
      const result = await onSendReply(content);

      // Sjekk om vi fikk tilbake URL og informasjon om en outlook_redirect action
      if (
        result &&
        "action" in result &&
        result.action?.type === "outlook_redirect"
      ) {
        // Vis preview dialog istedet for å åpne direkte
        setReplyPreviewContent(result.action.content);
        setReplyUrl(result.action.url);

        // Hent mer informasjon hvis tilgjengelig
        if (result.action.emailInfo) {
          setEmailSubject(result.action.emailInfo.subject || "");
          setEmailRecipient(result.action.emailInfo.recipient || "");
        }

        // Vis preview dialog
        setShowReplyPreview(true);
        setReplySuccess(true);
      } else {
        // Fallback til gammel oppførsel
        setTimeout(() => {
          setReplySuccess(true);
          setTimeout(() => setReplySuccess(false), 5000);
        }, 1000);
      }
    } catch (error: any) {
      console.error("Error sending reply:", error);
      setReplyError(error.message || "Kunne ikke sende svar. Prøv igjen.");
      setTimeout(() => setReplyError(null), 5000);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Kopier svarinnhold til utklippstavlen
  const copyReplyContent = async () => {
    try {
      await navigator.clipboard.writeText(replyPreviewContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  };

  // Åpne Outlook med URL-en
  const openOutlookLink = () => {
    window.open(replyUrl, "_blank");
    // Lukk dialogen etter at vi har åpnet Outlook
    setShowReplyPreview(false);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-50">
      {/* Header */}
      {headerComponent}

      {/* Messages area - Takes available space */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Display error message if any */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Messages */}
        <div className="w-full">
          <div className="max-w-3xl mx-auto">
            {/* Info component - only shown initially */}
            {messages.length <= 1 && !error && infoComponent}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index} className="w-full">
                  {message.role === "user" ? (
                    <div className="flex justify-end mb-2">
                      <div className="bg-[#5E5ADB] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-sm">
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
                      <div className="mb-2 text-sm font-medium text-gray-600 px-1">
                        {assistantName}
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-6 py-4 text-gray-800 shadow-sm pb-6 relative">
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
                                    className="text-md font-semibold mt-5 mb-3"
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
                                  <p
                                    className="my-3 leading-relaxed"
                                    {...props}
                                  />
                                ),

                                // Style lists
                                ul: ({ ...props }) => (
                                  <ul
                                    className="my-3 ml-6 space-y-2 list-disc"
                                    {...props}
                                  />
                                ),
                                ol: ({ ...props }) => (
                                  <ol
                                    className="my-3 ml-6 space-y-2 list-decimal"
                                    {...props}
                                  />
                                ),
                                li: ({ children, ...props }) => {
                                  return (
                                    <li className="my-1" {...props}>
                                      {children}
                                    </li>
                                  );
                                },

                                // Style tables
                                table: ({ ...props }) => (
                                  <div className="my-4 overflow-x-auto">
                                    <table
                                      className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md"
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
                                      className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  ) : (
                                    <pre className="p-3 bg-gray-50 rounded-md overflow-auto text-sm my-3 font-mono">
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

                            {/* Reply button - only show for assistant messages with content and when emailId or threadId is available */}
                            {(emailId || threadId || index > 0) && (
                              <div className="mt-4 flex gap-2 items-center">
                                {(emailId || threadId) &&
                                onSendReply &&
                                message.content.trim() &&
                                index > 0 ? (
                                  <>
                                    {isSendingReply ? (
                                      <Button
                                        disabled
                                        className="text-xs h-8 bg-blue-500"
                                      >
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        Forbereder svar...
                                      </Button>
                                    ) : replySuccess ? (
                                      <div className="text-green-600 text-xs flex items-center">
                                        <span>✓</span> Outlook åpnet!
                                      </div>
                                    ) : (
                                      <Button
                                        onClick={() =>
                                          handleSendReply(message.content)
                                        }
                                        className="text-xs h-8 bg-blue-500 hover:bg-blue-600"
                                        size="sm"
                                      >
                                        <Reply className="h-3 w-3 mr-1" />
                                        Send som svar
                                      </Button>
                                    )}
                                    {replyError && (
                                      <div className="text-red-500 text-xs">
                                        {replyError}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-400">
                                    {!emailId && !threadId
                                      ? "Mangler ID"
                                      : !onSendReply
                                      ? "Mangler onSendReply"
                                      : !message.content.trim()
                                      ? "Tomt innhold"
                                      : index === 0
                                      ? "Første melding"
                                      : "Ukjent feil"}
                                  </div>
                                )}
                              </div>
                            )}
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
      </div>

      {/* Input area with attachment support - Fixed at bottom */}
      <div className="border-t bg-white py-4 w-full">
        <div className="max-w-3xl mx-auto px-4">
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
            <div className="bg-white border rounded-3xl shadow-sm px-4 py-3 focus-within:ring-1 focus-within:ring-[#5E5ADB] border-gray-200">
              <Input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                className="w-full py-2 px-0 border-0 focus:ring-0 focus:outline-none text-sm bg-transparent"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={disabled || isLoading}
              />
              <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
                    onClick={() => setIsResourcePickerOpen(true)}
                    disabled={disabled || isLoading}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21 14l-9 7-9-7m18-5l-9 7-9-7m18-5l-9 7-9-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Add</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm bg-[#C6F551] text-gray-800 font-medium px-3 py-1 rounded-full"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                    >
                      <path
                        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 8V16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 12H16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Web</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                    >
                      <path
                        d="M3 6H21"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 12H17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 18H14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Filters</span>
                  </button>
                </div>
                <Button
                  type="submit"
                  className="rounded-full h-9 w-9 p-0 flex items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors"
                  disabled={
                    (!input.trim() && attachedResources.length === 0) ||
                    disabled ||
                    isLoading
                  }
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 text-white"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          </form>
          <div className="flex justify-center mt-2 text-xs text-gray-500">
            <div className="text-center">
              AI assistants may produce inaccurate information.
            </div>
          </div>
        </div>
      </div>

      {/* Resource Picker Dialog */}
      <ResourcePicker
        open={isResourcePickerOpen}
        onOpenChange={setIsResourcePickerOpen}
        onSelectResources={handleSelectResources}
        userId={userId}
      />

      {/* Reply Preview Dialog */}
      <Dialog open={showReplyPreview} onOpenChange={setShowReplyPreview}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Svar på e-post{emailSubject ? `: ${emailSubject}` : ""}
            </DialogTitle>
            <DialogDescription>
              {emailRecipient
                ? `Til: ${emailRecipient}. Kopier teksten nedenfor og lim inn i Outlook.`
                : "Kopier teksten nedenfor og lim inn i Outlook."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 bg-gray-50 p-4 rounded-md text-sm relative border max-h-[250px] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans">
              {replyPreviewContent}
            </pre>
            <Button
              className="absolute top-2 right-2 h-8 w-8 p-0"
              size="sm"
              variant="ghost"
              onClick={copyReplyContent}
            >
              {isCopied ? (
                <CheckCheck className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowReplyPreview(false)}
            >
              Lukk
            </Button>
            <Button
              onClick={copyReplyContent}
              className="gap-2"
              variant={isCopied ? "outline" : "default"}
            >
              {isCopied ? (
                <>
                  <CheckCheck className="h-4 w-4" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Kopier tekst
                </>
              )}
            </Button>
            <Button onClick={openOutlookLink} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Åpne i Outlook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
