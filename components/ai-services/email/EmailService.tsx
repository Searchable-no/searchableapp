"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/hooks";
import { EmailMessage } from "@/lib/microsoft-graph";
import { MessageSquare, Bug, RotateCw, Building } from "lucide-react";
import { ApiDebug } from "./ApiDebug";
import { getData, refreshTileData } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailRenderer from "./EmailRenderer";

// Add styles to properly display email content
const emailContentStyles = `
  .email-content {
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    font-family: inherit;
    line-height: 1.5;
    color: inherit;
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

// Define a thread type
type EmailThread = {
  id: string;
  subject: string;
  emails: EmailMessage[];
  latestEmail: EmailMessage;
  hasUnread: boolean;
  conversationId: string;
};

// Helper for getting consistent background colors based on sender name
const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-yellow-100 text-yellow-700",
    "bg-red-100 text-red-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700",
    "bg-gray-100 text-gray-700",
  ];

  // Use a simple hash function to get a consistent color for each name
  const hashCode = name.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  return colors[Math.abs(hashCode) % colors.length];
};

// Helper to get initials from name
const getInitials = (name: string): string => {
  if (!name) return "?";

  // For email addresses, return the first letter
  if (name.includes("@")) {
    return name.charAt(0).toUpperCase();
  }

  // For names, get first letter of first and last name
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Helper to determine if a string is a company name
const isCompanyName = (name: string): boolean => {
  if (!name) return false;

  const companyWords = [
    "inc",
    "corp",
    "ltd",
    "llc",
    "gmbh",
    "co",
    "as",
    "ab",
    "sa",
    "pty",
    "limited",
  ];
  const lowercaseName = name.toLowerCase();

  return (
    companyWords.some((word) => lowercaseName.includes(word)) ||
    (!name.includes(" ") && !name.includes("@") && name.length > 2)
  );
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

  // Helper to render sender avatar consistently
  const renderSenderAvatar = (
    email: EmailMessage,
    size = "h-10 w-10",
    showUnread = false
  ) => {
    const fromName = email.from?.emailAddress?.name || "";
    const fromAddress = email.from?.emailAddress?.address || "";

    return (
      <Avatar
        className={`${size} ${
          showUnread && !email.isRead && !email.isSent
            ? "ring-2 ring-primary ring-offset-1"
            : ""
        } ${email.isSent ? "bg-blue-100 text-blue-600" : ""}`}
      >
        {fromAddress?.includes("@supabase") && (
          <AvatarImage src="/images/supabase-logo.png" alt="Supabase" />
        )}
        <AvatarFallback
          className={
            email.isSent ? "" : getAvatarColor(fromName || fromAddress || "?")
          }
        >
          {email.isSent ? (
            "Y" // "You"
          ) : isCompanyName(fromName) ? (
            <Building className="h-5 w-5" />
          ) : (
            getInitials(fromName || fromAddress || "?")
          )}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Add styles to component */}
      <style jsx global>
        {emailContentStyles}
      </style>

      <div className="flex flex-col md:flex-row w-full h-[calc(100vh-70px)] gap-0 border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Inbox Panel */}
        <div className="w-full md:w-[350px] lg:w-[400px] border-r border-gray-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <h2 className="font-medium text-gray-900">Inbox</h2>
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
              <div className="p-4 text-center text-muted-foreground">
                No emails found
              </div>
            ) : (
              <div className="flex flex-col">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                      selectedThread?.id === thread.id ? "bg-gray-50" : ""
                    }`}
                    onClick={() => selectThread(thread)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {renderSenderAvatar(
                          thread.latestEmail,
                          "h-9 w-9",
                          true
                        )}
                        {thread.emails.length > 1 && (
                          <div className="absolute -bottom-1 -right-1 bg-gray-200 text-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-medium">
                            {thread.emails.length}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span
                            className={`font-medium truncate ${
                              thread.hasUnread ? "text-black" : "text-gray-600"
                            }`}
                          >
                            {thread.latestEmail.from?.emailAddress?.name ||
                              thread.latestEmail.from?.emailAddress?.address}
                          </span>
                          <span className="text-gray-500 whitespace-nowrap ml-2">
                            {formatDistanceToNow(
                              new Date(thread.latestEmail.receivedDateTime)
                            )}
                          </span>
                        </div>
                        <div
                          className={`truncate mt-0.5 ${
                            thread.hasUnread
                              ? "font-semibold text-black"
                              : "font-medium text-gray-600"
                          }`}
                        >
                          {thread.subject}
                        </div>
                        <div className="text-gray-500 truncate mt-0.5">
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
              <div className="px-6 py-4 border-b border-gray-100 bg-white">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">
                  {selectedThread.subject}
                </h1>
                <div className="text-gray-500 flex items-center">
                  <span>
                    {selectedThread.emails.length} messages in conversation
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6 py-4">
                {threadLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
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
                          {renderSenderAvatar(email, "h-9 w-9 mt-1")}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {email.isSent
                                    ? "You"
                                    : email.from?.emailAddress?.name ||
                                      email.from?.emailAddress?.address}
                                </div>
                                <div className="text-gray-500 mt-0.5 flex items-center gap-2">
                                  <span>
                                    {new Date(
                                      email.receivedDateTime
                                    ).toLocaleString()}
                                  </span>
                                  {!email.isRead && !email.isSent && (
                                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                      Unread
                                    </span>
                                  )}
                                  {email.isSent && (
                                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                      Sent
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 text-gray-700">
                              <EmailRenderer email={email} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t border-gray-100">
                <Button
                  className="w-full gap-2 mx-auto h-10 rounded-lg shadow-sm bg-primary hover:bg-primary/90"
                  onClick={() =>
                    openChatWithEmail(selectedEmail, selectedThread)
                  }
                >
                  <MessageSquare className="h-4 w-4" />
                  Create AI Response
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-10 w-10 mb-3 text-gray-300" />
              <h3 className="font-medium mb-1">No email selected</h3>
              <p>Select an email thread from the inbox</p>
            </div>
          )}
        </div>
      </div>

      {/* Debug section */}
      <div className="mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-1"
        >
          <Bug className="h-3 w-3" />
          {showDebug ? "Hide Diagnostics" : "Show Diagnostics"}
        </Button>

        {showDebug && <ApiDebug />}
      </div>
    </div>
  );
}
