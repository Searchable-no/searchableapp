"use client";

import {
  useEffect,
  useRef,
  FormEvent,
  ReactNode,
  useState,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Loader2,
  Reply,
  Copy,
  CheckCheck,
  ExternalLink,
  Paperclip,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  disabled?: boolean;
  placeholder?: string;
  userId?: string;
  emailId?: string;
  threadId?: string;
  onSendReply?: (content: string) => Promise<ReplyResponse | void>;
}

// Auto-resizing textarea component
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to adjust height based on content
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Initialize height and add event listeners
  useEffect(() => {
    adjustHeight();
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("input", adjustHeight);
      return () => textarea.removeEventListener("input", adjustHeight);
    }
  }, []);

  // Adjust height when value changes externally
  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Handle key press events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but not with Shift key)
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
    // Shift+Enter creates a line break (default behavior, no need to do anything)
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 outline-none text-sm px-2 resize-none overflow-y-auto min-h-[24px] max-h-[200px] w-full"
      rows={1}
      style={{ height: "24px" }}
    />
  );
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
  disabled = false,
  placeholder = "Ask anything...",
  userId = "",
  emailId,
  threadId,
  onSendReply,
}: ChatProps) {
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

  // Logging for debug
  useEffect(() => {
    if (!messages || messages.length === 0) {
      console.log("Chat component: No messages to display");
    } else {
      console.log(`Chat component: Displaying ${messages.length} messages`);
      console.log("First few messages:", messages.slice(0, 3));
    }
  }, [messages]);

  // Validate messages format
  const validMessages = useMemo(() => {
    if (!Array.isArray(messages)) {
      console.error("Invalid messages format: not an array");
      return [];
    }

    return messages.filter(
      (message) =>
        message &&
        typeof message === "object" &&
        (message.role === "user" || message.role === "assistant") &&
        message.content !== undefined
    );
  }, [messages]);

  // Scroll to bottom of messages when new ones come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle submitting a message
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (
      !input.trim() &&
      (!attachedResources || attachedResources.length === 0)
    ) {
      return;
    }

    try {
      // Call the parent submit handler
      await onSubmit(
        input,
        attachedResources.length > 0 ? attachedResources : undefined
      );

      // Reset input and attached resources
      setInput("");
      setAttachedResources([]);

      // Log for debugging
      console.log(
        "Message submitted successfully. Current valid message count:",
        validMessages.length
      );
    } catch (err) {
      console.error("Error submitting message:", err);
    }
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
    } catch (error: unknown) {
      console.error("Error sending reply:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Kunne ikke sende svar. Prøv igjen.";
      setReplyError(errorMessage);
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

  // Copy message content
  const copyMessageContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Could add a visual indicator here
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white">
      {/* Header */}
      {headerComponent || (
        <header className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <Select defaultValue="all">
              <SelectTrigger className="w-[70px] border-none shadow-none focus:ring-0">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="saved">Saved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-black hover:bg-gray-100">
              Help
            </Button>
            <div className="w-6 h-6 border border-gray-300 rounded"></div>
          </div>
        </header>
      )}

      {/* Messages area - Takes available space */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Display error message if any */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 flex items-start gap-2 max-w-3xl mx-auto">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Messages */}
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Info component - only shown initially */}
          {validMessages.length <= 1 && !error && infoComponent}

          {validMessages.map((message, index) => (
            <div key={index} className="w-full">
              {message.role === "user" ? (
                <div className="flex flex-col items-end space-y-2">
                  <div className="bg-gray-100 rounded-2xl py-2 px-4 max-w-xs sm:max-w-md">
                    {message.attachments && message.attachments.length > 0 && (
                      <AttachedResources
                        resources={message.attachments}
                        className="mb-3"
                        readonly
                      />
                    )}
                    <p className="text-sm font-medium">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  <div className="bg-white border rounded-2xl py-3 px-4">
                    {message.content ? (
                      <>
                        <div className="prose prose-sm max-w-none text-gray-800">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children, ...props }) => (
                                <p className="text-sm" {...props}>
                                  {children}
                                </p>
                              ),
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
                              li: ({ children, ...props }) => (
                                <li className="text-sm" {...props}>
                                  {children}
                                </li>
                              ),
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

                          <div className="flex items-center mt-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8"
                              onClick={() =>
                                copyMessageContent(message.content)
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>

                            {/* Reply button - only show for assistant messages with content */}
                            {(emailId || threadId) &&
                              onSendReply &&
                              message.content.trim() &&
                              index > 0 && (
                                <Button
                                  onClick={() =>
                                    handleSendReply(message.content)
                                  }
                                  className="text-xs h-8 ml-2"
                                  size="sm"
                                  variant="ghost"
                                >
                                  {isSendingReply ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Preparing...
                                    </>
                                  ) : replySuccess ? (
                                    <div className="text-green-600 text-xs flex items-center">
                                      <CheckCheck className="h-3 w-3 mr-1" />
                                      Sent!
                                    </div>
                                  ) : (
                                    <>
                                      <Reply className="h-3 w-3 mr-1" />
                                      Reply
                                    </>
                                  )}
                                </Button>
                              )}
                          </div>

                          {replyError && (
                            <div className="text-red-500 text-xs mt-2">
                              {replyError}
                            </div>
                          )}
                        </div>
                      </>
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
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area with attachment support - Fixed at bottom */}
      <div className="p-4 border-t">
        <div className="max-w-3xl mx-auto">
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

          <form onSubmit={handleSubmit}>
            <div className="border rounded-2xl p-3 flex items-start">
              <AutoResizeTextarea
                value={input}
                onChange={setInput}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                onSubmit={handleSubmit}
              />
              <div className="flex items-center gap-2 mt-1 ml-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setIsResourcePickerOpen(true)}
                  disabled={disabled || isLoading}
                >
                  <Paperclip className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  className="rounded-full h-8 w-8 bg-black hover:bg-gray-800 ml-1"
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
                      className="h-4 w-4 text-white"
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
