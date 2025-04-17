"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/hooks";
import { EmailMessage } from "@/lib/microsoft-graph";
import { MessageSquare, Bug, RotateCw } from "lucide-react";
import { ApiDebug } from "./ApiDebug";
import { getData, refreshTileData } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailRenderer from "./EmailRenderer";

// Add styles to properly display email content
const emailContentStyles = `
  .email-content {
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
  }
  
  .email-content img {
    max-width: 100%;
    height: auto;
  }
  
  .email-content a {
    color: #3b82f6;
    text-decoration: underline;
  }
  
  .email-content blockquote {
    border-left: 3px solid #e5e7eb;
    padding-left: 1rem;
    margin-left: 0;
    color: #6b7280;
  }
  
  .email-content pre {
    background-color: #f3f4f6;
    padding: 0.75rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  
  .email-content table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1rem;
  }
  
  .email-content table td, .email-content table th {
    border: 1px solid #e5e7eb;
    padding: 0.5rem;
  }
  
  .email-content p {
    margin-bottom: 1rem;
  }
  
  .email-content ul, .email-content ol {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
  
  .email-content h1, .email-content h2, .email-content h3,
  .email-content h4, .email-content h5, .email-content h6 {
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    font-weight: 600;
    line-height: 1.25;
  }
  
  .email-content h1 { font-size: 1.5rem; }
  .email-content h2 { font-size: 1.25rem; }
  .email-content h3 { font-size: 1.125rem; }
  
  /* Fix for Outlook-style emails */
  .email-content div[style*="margin-left: 1em"] {
    margin-left: 1em !important;
  }
  
  /* Fix for Gmail divider styles */
  .email-content .gmail_quote {
    border-left: 1px solid #ccc;
    padding-left: 12px;
    color: #666;
  }
`;

// Helper function to sanitize and parse HTML content
const renderEmailContent = (htmlContent: string) => {
  if (!htmlContent) return <p>No content available</p>;

  // Sanitize HTML first using DOMPurify
  const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"], // Allow target attribute for links
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"], // Remove event handlers
  });

  // Then parse it to React elements
  return <div className="email-content">{parse(sanitizedHtml)}</div>;
};

// Define a thread type
type EmailThread = {
  id: string;
  subject: string;
  emails: EmailMessage[];
  latestEmail: EmailMessage;
  hasUnread: boolean;
  conversationId: string;
};

export default function EmailService() {
  const router = useRouter();
  useUser();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(
    null
  );
  const [showDebug, setShowDebug] = useState(false);

  // Group emails into threads
  const threads = useMemo(() => {
    const threadMap = new Map<string, EmailMessage[]>();

    // Group emails by conversationId
    emails.forEach((email: EmailMessage) => {
      if (!email.conversationId) return;

      const existing = threadMap.get(email.conversationId) || [];
      threadMap.set(email.conversationId, [...existing, email]);
    });

    // Convert to thread objects
    return Array.from(threadMap.entries())
      .map(([conversationId, threadEmails]) => {
        // Sort emails by date, oldest first (for display)
        const sortedEmails = [...threadEmails].sort(
          (a, b) =>
            new Date(a.receivedDateTime).getTime() -
            new Date(b.receivedDateTime).getTime()
        );

        // But use the newest email as the latestEmail for thread info
        const latestEmail = [...threadEmails].sort(
          (a, b) =>
            new Date(b.receivedDateTime).getTime() -
            new Date(a.receivedDateTime).getTime()
        )[0];

        const hasUnread = sortedEmails.some(
          (email: EmailMessage) => !email.isRead
        );

        return {
          id: conversationId,
          subject: latestEmail.subject || "(No subject)",
          emails: sortedEmails,
          latestEmail,
          hasUnread,
          conversationId,
        };
      })
      .sort(
        // Sort threads by date of latest email, newest first
        (a, b) =>
          new Date(b.latestEmail.receivedDateTime).getTime() -
          new Date(a.latestEmail.receivedDateTime).getTime()
      );
  }, [emails]);

  // Fetch emails on component mount
  useEffect(() => {
    const fetchEmails = async () => {
      try {
        console.log("EmailService: Fetching emails using dashboard actions...");

        // Use the dashboard getData action to fetch emails
        const data = await getData(["email"]);

        if (data.error) {
          console.error("EmailService: Error fetching emails:", data.error);
          throw new Error(data.error);
        }

        console.log(
          `EmailService: Received ${data.emails?.length || 0} emails`
        );

        if (data.emails && data.emails.length > 0) {
          setEmails(data.emails);

          // Group the emails and select the first thread
          if (data.emails.some((email: EmailMessage) => email.conversationId)) {
            // Wait for threads to be computed in the next render
            setTimeout(() => {
              if (threads.length > 0) {
                setSelectedThread(threads[0]);
                setSelectedEmail(threads[0].latestEmail);
              }
            }, 0);
          } else {
            // Fall back to selecting the first email if no conversation IDs
            setSelectedEmail(data.emails[0]);
          }
        }
      } catch (error) {
        console.error("EmailService: Error fetching emails:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, []);

  // Add a function to handle refresh
  const handleRefresh = async () => {
    try {
      setLoading(true);
      console.log("EmailService: Refreshing emails...");

      // Use the dashboard refreshTileData action
      const data = await refreshTileData("email");

      if (data.error) {
        console.error("EmailService: Error refreshing emails:", data.error);
        throw new Error(data.error);
      }

      console.log(`EmailService: Refreshed ${data.emails?.length || 0} emails`);
      setEmails(data.emails || []);

      if (data.emails && data.emails.length > 0 && !selectedEmail) {
        setSelectedEmail(data.emails[0]);
      }

      return true;
    } catch (error) {
      console.error("EmailService: Error refreshing emails:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to ensure we get complete email content
  const getFullEmailContent = (email: EmailMessage): string => {
    // Try to get the complete content with fallbacks

    // First try the body content which should contain the full HTML
    if (email.body?.content && email.body.content.trim().length > 0) {
      // Check if content appears to be truncated (ends abruptly with no closing tags)
      const content = email.body.content;

      // Simple check if the content appears complete
      if (
        content.includes("</html>") ||
        content.includes("</body>") ||
        content.trim().endsWith("</div>") ||
        content.trim().endsWith("</p>")
      ) {
        return content;
      }

      // If content seems truncated, try to add closure
      if (email.bodyPreview && !content.includes(email.bodyPreview)) {
        return `${content}<p>${email.bodyPreview}...</p>`;
      }

      return content;
    }

    // If no body content, try bodyPreview
    if (email.bodyPreview && email.bodyPreview.trim().length > 0) {
      return `<p>${email.bodyPreview}</p>`;
    }

    // Fallback
    return "<p>No content available</p>";
  };

  const selectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    setSelectedEmail(thread.latestEmail);

    // Fetch complete thread content when thread is selected
    fetchCompleteThread(thread.conversationId);
  };

  // Function to fetch complete thread from Microsoft Graph API
  const fetchCompleteThread = async (conversationId: string) => {
    if (!conversationId) return;

    try {
      // Use separate loading state to avoid refreshing inbox
      setThreadLoading(true);
      console.log(
        `Fetching complete thread with conversationId: ${conversationId}`
      );

      // Call our backend API that will query Microsoft Graph
      const response = await fetch(
        `/api/emails/thread?conversationId=${encodeURIComponent(
          conversationId
        )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch complete thread: ${response.status}`);
      }

      const data = await response.json();

      if (data.emails && Array.isArray(data.emails) && data.emails.length > 0) {
        console.log(
          `Received ${data.emails.length} emails for thread ${conversationId}`
        );

        // Create a new updatedEmails array but don't set it yet
        const updatedEmails = [...emails];

        // Replace or add the fetched emails to our current email list
        data.emails.forEach((fetchedEmail: EmailMessage) => {
          const existingIndex = updatedEmails.findIndex(
            (email) => email.id === fetchedEmail.id
          );
          if (existingIndex >= 0) {
            // Replace existing email with more complete data
            updatedEmails[existingIndex] = fetchedEmail;
          } else {
            // Add new email from thread that wasn't in our list
            updatedEmails.push(fetchedEmail);
          }
        });

        // Only update specific thread in memory, not the whole inbox
        const fetchedThreadEmails = data.emails;

        // Sort the emails by date, oldest first
        const sortedThreadEmails = [...fetchedThreadEmails].sort(
          (a, b) =>
            new Date(a.receivedDateTime).getTime() -
            new Date(b.receivedDateTime).getTime()
        );

        // Get the latest email for thread display
        const latestEmail = [...fetchedThreadEmails].sort(
          (a, b) =>
            new Date(b.receivedDateTime).getTime() -
            new Date(a.receivedDateTime).getTime()
        )[0];

        // Create the updated thread
        const updatedThread: EmailThread = {
          id: conversationId,
          subject: latestEmail.subject || "(No subject)",
          emails: sortedThreadEmails,
          latestEmail,
          hasUnread: sortedThreadEmails.some(
            (email: EmailMessage) => !email.isRead
          ),
          conversationId,
        };

        // Update only the selected thread with complete data
        setSelectedThread(updatedThread);

        // Silently update our emails array in the background
        // without triggering loading state for inbox
        setEmails(updatedEmails);
      }
    } catch (error) {
      console.error("Error fetching complete thread:", error);
    } finally {
      setThreadLoading(false);
    }
  };

  const openChatWithEmail = async (
    email: EmailMessage,
    thread?: EmailThread
  ) => {
    try {
      // If we have a thread but haven't fetched complete data, fetch it now
      if (thread && thread.emails.length > 0) {
        // Try to fetch complete thread data before opening chat
        await fetchCompleteThread(thread.conversationId);

        // After fetching, get the updated thread
        const updatedThread = threads.find((t) => t.id === thread.id);
        if (updatedThread) {
          // Save the complete thread with all emails and full content
          const threadKey = `thread_${updatedThread.id}`;
          localStorage.setItem(
            threadKey,
            JSON.stringify({
              subject: updatedThread.subject,
              emails: updatedThread.emails,
            })
          );

          // Navigate to the chat page with the thread ID
          router.push(
            `/ai-services/email/chat?threadId=${encodeURIComponent(
              updatedThread.id
            )}&subject=${encodeURIComponent(
              updatedThread.subject || "Email Thread"
            )}`
          );
          return;
        }
      }

      // Fall back to single email if no thread or fetch failed
      const emailKey = `email_${email.id}`;
      localStorage.setItem(emailKey, JSON.stringify(email));

      // Navigate to the chat page with the email ID
      router.push(
        `/ai-services/email/chat?id=${email.id}&subject=${encodeURIComponent(
          email.subject || "Email"
        )}`
      );
    } catch (err) {
      console.error("Failed to prepare email for chat:", err);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Add styles to component */}
      <style jsx global>
        {emailContentStyles}
      </style>

      <div className="flex flex-col md:flex-row w-full h-[calc(100vh-150px)] gap-0 border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Inbox Panel */}
        <div className="w-full md:w-[380px] border-r border-gray-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
            <h2 className="text-lg font-medium text-gray-900">Inbox</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              <RotateCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : threads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No emails found
              </div>
            ) : (
              <div className="flex flex-col">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                      selectedThread?.id === thread.id ? "bg-gray-50" : ""
                    }`}
                    onClick={() => selectThread(thread)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar
                          className={`h-10 w-10 ${
                            thread.hasUnread
                              ? "ring-2 ring-primary ring-offset-2"
                              : ""
                          }`}
                        >
                          <span className="font-semibold">
                            {(
                              thread.latestEmail.from?.emailAddress?.name ||
                              thread.latestEmail.from?.emailAddress?.address ||
                              "?"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </Avatar>
                        {thread.emails.length > 1 && (
                          <div className="absolute -bottom-1 -right-1 bg-gray-200 text-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-medium">
                            {thread.emails.length}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span
                            className={`font-medium text-sm truncate ${
                              thread.hasUnread ? "text-black" : "text-gray-600"
                            }`}
                          >
                            {thread.latestEmail.from?.emailAddress?.name ||
                              thread.latestEmail.from?.emailAddress?.address}
                          </span>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {formatDistanceToNow(
                              new Date(thread.latestEmail.receivedDateTime)
                            )}
                          </span>
                        </div>
                        <div
                          className={`text-sm truncate mt-0.5 ${
                            thread.hasUnread
                              ? "font-semibold text-black"
                              : "font-medium text-gray-600"
                          }`}
                        >
                          {thread.subject}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {thread.latestEmail.bodyPreview}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Email Content Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedEmail && selectedThread ? (
            <>
              <div className="px-8 py-6 border-b border-gray-100 bg-white">
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  {selectedThread.subject}
                </h1>
                <div className="text-sm text-gray-500 flex items-center">
                  <span>
                    {selectedThread.emails.length} messages in conversation
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 px-8 py-6">
                {threadLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="space-y-8 max-w-3xl mx-auto">
                    {/* Display all emails in the thread in chronological order */}
                    {selectedThread?.emails.map((email, index) => (
                      <div key={email.id} className="relative">
                        {index > 0 && (
                          <div className="absolute left-5 -top-4 h-4 w-0.5 bg-gray-200"></div>
                        )}
                        <div
                          className={`flex items-start gap-4 ${
                            email.isSent
                              ? "bg-blue-50/30 p-4 rounded-lg border border-blue-100"
                              : ""
                          }`}
                        >
                          <Avatar
                            className={`h-10 w-10 mt-1 ${
                              email.isSent ? "bg-blue-100 text-blue-600" : ""
                            }`}
                          >
                            <span className="font-semibold">
                              {email.isSent
                                ? "Y" // "You"
                                : (
                                    email.from?.emailAddress?.name ||
                                    email.from?.emailAddress?.address ||
                                    "?"
                                  )
                                    .charAt(0)
                                    .toUpperCase()}
                            </span>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {email.isSent
                                    ? "You"
                                    : email.from?.emailAddress?.name ||
                                      email.from?.emailAddress?.address}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                  <span>
                                    {new Date(
                                      email.receivedDateTime
                                    ).toLocaleString()}
                                  </span>
                                  {!email.isRead && !email.isSent && (
                                    <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded">
                                      Unread
                                    </span>
                                  )}
                                  {email.isSent && (
                                    <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded">
                                      Sent
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 text-gray-700 text-sm">
                              <EmailRenderer email={email} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="p-6 border-t border-gray-100">
                <Button
                  className="w-full max-w-lg gap-2 mx-auto h-12 rounded-lg shadow-sm bg-primary hover:bg-primary/90"
                  onClick={() =>
                    openChatWithEmail(selectedEmail, selectedThread)
                  }
                >
                  <MessageSquare className="h-5 w-5" />
                  Create AI Response
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-1">No email selected</h3>
              <p className="text-sm">Select an email thread from the inbox</p>
            </div>
          )}
        </div>
      </div>

      {/* Debug section */}
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-1 text-xs"
        >
          <Bug className="h-3 w-3" />
          {showDebug ? "Hide Diagnostics" : "Show Diagnostics"}
        </Button>

        {showDebug && <ApiDebug />}
      </div>
    </div>
  );
}
