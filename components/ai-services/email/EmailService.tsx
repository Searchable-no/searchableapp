"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/hooks";
import { EmailMessage } from "@/lib/microsoft-graph";
import {
  MessageSquare,
  Bug,
  RotateCw,
  Building,
  Search,
  Menu,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { ApiDebug } from "./ApiDebug";
import { getData, refreshTileData } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
// Enhanced EmailRenderer with juice for CSS inlining and improved Outlook rendering
import EmailRenderer from "./EmailRenderer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Add styles to properly display email content
const emailContentStyles = `
  .email-content {
    overflow-wrap: break-word;
    word-wrap: break-word;
    font-family: inherit;
    line-height: 1.5;
    color: inherit;
  }
  
  .email-content img {
    max-width: 100%;
    height: auto;
  }
  
  .email-content a {
    color: #8b5cf6;
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
    border-radius: 0.5rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  
  .email-content p {
    margin-bottom: 1rem;
  }
  
  .email-content ul, .email-content ol {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
  
  .email-content li {
    margin-bottom: 0.5em;
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

  /* Fix Outlook/Exchange formatting */
  .email-content .MsoNormal {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }
  
  /* Fix checkboxes */
  .email-content input[type="checkbox"] {
    margin-right: 5px;
  }
  
  /* Don't break the layout of specific emails */
  .email-content [src*="asana"] + table,
  .email-content [alt*="asana"] + table,
  .email-content table:has(td[background]) {
    width: auto !important;
    table-layout: fixed !important;
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

// Get color based on sender name for the gradient background
const getAvatarGradient = (name: string): string => {
  const gradients = [
    "bg-gradient-to-br from-blue-400 to-cyan-500",
    "bg-gradient-to-br from-orange-400 to-pink-500",
    "bg-gradient-to-br from-green-400 to-teal-500",
    "bg-gradient-to-br from-purple-400 to-indigo-500",
    "bg-gradient-to-br from-red-400 to-pink-500",
    "bg-gradient-to-br from-amber-400 to-orange-500",
    "bg-gradient-to-br from-violet-400 to-purple-500",
    "bg-gradient-to-br from-blue-400 to-indigo-500",
    "bg-gradient-to-br from-emerald-400 to-green-500",
  ];

  // Simple hash to get consistent colors
  const hashCode = name.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  return gradients[Math.abs(hashCode) % gradients.length];
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

// Helper to format time as relative
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(10); // Number of read emails to display initially
  const [page, setPage] = useState(1); // Track which page of emails we're on
  const [loadingMore, setLoadingMore] = useState(false); // Loading state for fetching more emails
  const [hasMoreEmails, setHasMoreEmails] = useState(true); // Track if there are more emails to load
  const [returnedFromChat, setReturnedFromChat] = useState<string | null>(null); // Track if user returned from chat

  // Check if user has returned from AI chat
  useEffect(() => {
    // Get return information from localStorage
    const storedReturnInfo = localStorage.getItem("emailReturnInfo");
    if (storedReturnInfo) {
      try {
        const returnInfo = JSON.parse(storedReturnInfo);
        // If return info is recent (less than 5 seconds)
        const returnTimestamp = returnInfo.timestamp || 0;
        const now = new Date().getTime();
        const isRecent = now - returnTimestamp < 5000; // 5 seconds

        if (isRecent) {
          // Mark the thread the user was working with
          if (returnInfo.threadId) {
            setReturnedFromChat(returnInfo.threadId);

            // Clear the return info after 3 seconds
            setTimeout(() => {
              setReturnedFromChat(null);
            }, 3000);
          }
        }
      } catch (e) {
        console.error("Failed to parse return info:", e);
      }
    }
  }, []);

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

    // On mobile, close sidebar when thread is selected
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
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

          // Also save the return path information
          localStorage.setItem(
            "emailReturnInfo",
            JSON.stringify({
              returnPath: "/ai-services/email",
              threadId: updatedThread.id,
              timestamp: new Date().getTime(),
              label: "Back to Email",
            })
          );

          // Navigate to the chat page with the thread ID
          router.push(
            `/ai-services/email/chat?threadId=${encodeURIComponent(
              updatedThread.id
            )}&subject=${encodeURIComponent(
              updatedThread.subject || "Email Thread"
            )}&returnToEmail=true`
          );
          return;
        }
      }

      // Fall back to single email if no thread or fetch failed
      const emailKey = `email_${email.id}`;
      localStorage.setItem(emailKey, JSON.stringify(email));

      // Save return path information for a single email too
      localStorage.setItem(
        "emailReturnInfo",
        JSON.stringify({
          returnPath: "/ai-services/email",
          emailId: email.id,
          timestamp: new Date().getTime(),
          label: "Back to Email",
        })
      );

      // Navigate to the chat page with the email ID and return flag
      router.push(
        `/ai-services/email/chat?id=${email.id}&subject=${encodeURIComponent(
          email.subject || "Email"
        )}&returnToEmail=true`
      );
    } catch (err) {
      console.error("Failed to prepare email for chat:", err);
    }
  };

  // Simplified email item component for the sidebar
  const EmailItem = ({ thread }: { thread: EmailThread }) => {
    const email = thread.latestEmail;
    const fromName = email.from?.emailAddress?.name || "";
    const fromAddress = email.from?.emailAddress?.address || "";
    const displayName = fromName || fromAddress || "?";
    const isActive = selectedThread?.id === thread.id;
    const hasUnread = thread.hasUnread;
    // Check if this is the thread user returned from in chat
    const isReturned = returnedFromChat === thread.id;

    // Get the time formatted as relative (e.g., 10m, 2h, 3d)
    const timeAgo = formatRelativeTime(email.receivedDateTime);

    // Get avatar colors and initials
    const avatarGradient = getAvatarGradient(displayName);
    const initials = getInitials(displayName);

    return (
      <div
        className={`flex items-center p-2 rounded-xl transition-all duration-200 mb-1 cursor-pointer ${
          isActive
            ? "bg-violet-50 hover:bg-violet-100/80"
            : isReturned
              ? "bg-violet-50/50 hover:bg-violet-100/80 border border-violet-200"
              : hasUnread
                ? "bg-white hover:bg-zinc-100/80 shadow-sm"
                : "hover:bg-zinc-100/80"
        }`}
        onClick={() => selectThread(thread)}
      >
        <Avatar
          className={`h-8 w-8 mr-3 flex-shrink-0 ${
            hasUnread
              ? "ring-2 ring-white"
              : isReturned
                ? "ring-2 ring-violet-200"
                : ""
          }`}
        >
          {fromAddress?.includes("@supabase") && (
            <AvatarImage src="/images/supabase-logo.png" alt="Supabase" />
          )}
          <AvatarFallback className={`${avatarGradient} text-white text-sm`}>
            {email.isSent ? (
              "Y"
            ) : isCompanyName(fromName) ? (
              <Building className="h-4 w-4" />
            ) : (
              initials
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-zinc-400 ml-2 flex-shrink-0">
                {timeAgo}
              </p>
            </div>
            <p
              className={`text-sm ${
                hasUnread || isReturned ? "font-medium" : "text-zinc-500"
              } truncate max-w-[220px]`}
            >
              {thread.subject}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Function to load more emails from the API
  const loadMoreEmails = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;

      console.log("EmailService: Loading more emails...");

      // Call the API with page parameter to get the next batch of emails
      // Include credentials: 'include' to send cookies for authentication
      const response = await fetch(`/api/emails?page=${nextPage}&limit=10`, {
        method: "GET",
        credentials: "include", // This is the key change - include auth cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch more emails: ${response.status}`);
      }

      const data = await response.json();

      if (data.emails && data.emails.length > 0) {
        console.log(`EmailService: Received ${data.emails.length} more emails`);

        // Add the new emails to our existing emails
        setEmails((prevEmails) => {
          // Create a Set of existing email IDs for quick lookup
          const existingIds = new Set(prevEmails.map((e) => e.id));
          // Filter out any emails that already exist in our state
          const newEmails = data.emails.filter(
            (email: EmailMessage) => !existingIds.has(email.id)
          );
          return [...prevEmails, ...newEmails];
        });

        // Increment page number for next fetch
        setPage(nextPage);
        // Increase display limit to show more emails
        setDisplayLimit((prevLimit) => prevLimit + 10);
        // If we got fewer emails than requested, there are no more
        if (data.emails.length < 10) {
          setHasMoreEmails(false);
        }
      } else {
        console.log("EmailService: No more emails available");
        setHasMoreEmails(false);
      }
    } catch (error) {
      console.error("Error loading more emails:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Add styles to component */}
      <style jsx global>
        {emailContentStyles}
      </style>

      <div className="flex h-[calc(100vh-70px)] bg-zinc-50/50 text-zinc-900">
        {/* Mobile sidebar toggle */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-500"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 transition-transform duration-300 fixed lg:relative z-40 w-80 h-full bg-white flex flex-col border-r border-zinc-100`}
        >
          <div className="p-5 flex items-center justify-between">
            <h1 className="text-lg font-medium tracking-tight">Inbox</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 w-8 rounded-full text-zinc-500"
            >
              <RotateCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search messages"
                className="pl-9 border-none bg-zinc-100/80 text-sm h-9 rounded-xl focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="pt-2 px-2 pb-4">
              {/* Email items */}
              {loading ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full"></div>
                </div>
              ) : threads.length === 0 ? (
                <div className="p-4 text-center text-zinc-500">
                  No emails found
                </div>
              ) : (
                <>
                  {/* Unread emails section */}
                  {threads.filter((t) => t.hasUnread).length > 0 && (
                    <div className="flex items-center justify-between px-2 py-2">
                      <div className="text-xs font-medium text-zinc-500">
                        UNREAD
                      </div>
                      <div className="text-xs font-medium text-violet-600">
                        {threads.filter((t) => t.hasUnread).length} new
                      </div>
                    </div>
                  )}

                  {/* Unread emails first */}
                  <div className="space-y-1">
                    {threads
                      .filter((t) => t.hasUnread)
                      .map((thread) => (
                        <EmailItem key={thread.id} thread={thread} />
                      ))}
                  </div>

                  {/* Modified to separate RECENT (within 7 days) from EARLIER emails */}
                  {/* Recent emails (within 7 days) */}
                  {(() => {
                    // Get date 7 days ago for comparison
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                    // Filter for read emails within the last 7 days
                    const recentThreads = threads.filter(
                      (t) =>
                        !t.hasUnread &&
                        new Date(t.latestEmail.receivedDateTime) >= sevenDaysAgo
                    );

                    return recentThreads.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between px-2 py-2 mt-4">
                          <div className="text-xs font-medium text-zinc-500">
                            RECENT
                          </div>
                        </div>
                        <div className="space-y-1">
                          {recentThreads
                            .slice(0, displayLimit)
                            .map((thread) => (
                              <EmailItem key={thread.id} thread={thread} />
                            ))}
                        </div>
                      </>
                    ) : null;
                  })()}

                  {/* Earlier emails (older than 7 days) */}
                  {(() => {
                    // Get date 7 days ago for comparison
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                    // Filter for read emails older than 7 days
                    const earlierThreads = threads.filter(
                      (t) =>
                        !t.hasUnread &&
                        new Date(t.latestEmail.receivedDateTime) < sevenDaysAgo
                    );

                    return earlierThreads.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between px-2 py-2 mt-4">
                          <div className="text-xs font-medium text-zinc-500">
                            EARLIER
                          </div>
                        </div>
                        <div className="space-y-1">
                          {earlierThreads
                            .slice(0, displayLimit)
                            .map((thread) => (
                              <EmailItem key={thread.id} thread={thread} />
                            ))}
                        </div>
                      </>
                    ) : null;
                  })()}

                  {/* Always show a Load more button at the bottom with proper spacing */}
                  {!loading &&
                    threads.filter((t) => !t.hasUnread).length > 0 && (
                      <div className="flex justify-center py-3 mt-4 mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs w-[calc(100%-2rem)] bg-white hover:bg-zinc-100 border border-zinc-200 shadow-sm"
                          onClick={loadMoreEmails}
                          disabled={loadingMore || !hasMoreEmails}
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : !hasMoreEmails ? (
                            <>No more emails</>
                          ) : (
                            <>
                              Load more emails
                              <ChevronDown className="h-3.5 w-3.5 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          {/* Header */}
          {selectedEmail && selectedThread ? (
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 h-8 w-8 rounded-full lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <h2 className="text-base font-medium">
                  {selectedThread.subject}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="outline"
                  className="mr-2 bg-zinc-100 text-zinc-600 border-none"
                >
                  {selectedThread.emails.length} message
                  {selectedThread.emails.length !== 1 ? "s" : ""}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 h-8 w-8 rounded-full lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <h2 className="text-base font-medium">Email</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4 text-zinc-500" />
              </Button>
            </div>
          )}

          {/* Email content panel */}
          {selectedEmail && selectedThread ? (
            <div className="flex-1 overflow-auto">
              <div className="w-full p-2 lg:p-4">
                {threadLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Display all emails in the thread in chronological order */}
                    {selectedThread?.emails.map((email) => {
                      const fromName = email.from?.emailAddress?.name || "";
                      const fromAddress =
                        email.from?.emailAddress?.address || "";
                      const displayName = email.isSent
                        ? "You"
                        : fromName || fromAddress || "?";
                      const avatarGradient = email.isSent
                        ? "bg-gradient-to-br from-blue-400 to-indigo-500"
                        : getAvatarGradient(displayName);
                      const formattedDate = new Date(
                        email.receivedDateTime
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <div key={email.id} className="space-y-4 w-full">
                          <div className="flex items-center mb-4">
                            <Avatar className="h-10 w-10 mr-4 ring-2 ring-white ring-offset-2 ring-offset-violet-100">
                              <AvatarFallback
                                className={`${avatarGradient} text-white font-normal`}
                              >
                                {email.isSent ? (
                                  "Y"
                                ) : isCompanyName(fromName) ? (
                                  <Building className="h-5 w-5" />
                                ) : (
                                  getInitials(displayName)
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-baseline">
                                <h3 className="font-medium text-base">
                                  {displayName}
                                </h3>
                                <span className="text-xs text-zinc-400 ml-3">
                                  {formattedDate}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-500">
                                to recipient
                              </p>
                            </div>
                          </div>

                          <div className="w-full text-zinc-700">
                            <EmailRenderer email={email} className="w-full" />
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-4">
                      <Button
                        className="rounded-xl px-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all duration-300 shadow-sm"
                        onClick={() =>
                          openChatWithEmail(selectedEmail, selectedThread)
                        }
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Create AI Response
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <MessageSquare className="h-12 w-12 mb-4 text-zinc-300" />
              <h3 className="text-lg font-medium mb-1">No email selected</h3>
              <p className="text-sm">Select an email thread from the inbox</p>
            </div>
          )}
        </div>
      </div>

      {/* Debug section */}
      {showDebug && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1 mb-2"
          >
            <Bug className="h-3 w-3" />
            Hide Diagnostics
          </Button>
          <ApiDebug />
        </div>
      )}

      {!showDebug && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1"
          >
            <Bug className="h-3 w-3" />
            Show Diagnostics
          </Button>
        </div>
      )}
    </div>
  );
}
