"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Eye, EyeOff, MoreVertical, Mail } from "lucide-react";
import React from "react";
import Chat, { Message } from "@/components/ai-services/Chat";
import { Button } from "@/components/ui/button";
import { Microsoft365Resource } from "@/components/ai-services/ResourcePicker";
import { toast } from "@/components/ui/use-toast";

type EmailAddress = {
  name?: string;
  address?: string;
};

type EmailMessage = {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    content: string;
    contentType: string;
  };
  from?: {
    emailAddress: EmailAddress;
  };
  toRecipients?: Array<{
    emailAddress: EmailAddress;
  }>;
  ccRecipients?: Array<{
    emailAddress: EmailAddress;
  }>;
  receivedDateTime: string;
  webLink?: string;
  isSent?: boolean;
};

type ModelOption = "gpt-4o" | "o4-mini" | "gpt-4.1";

export default function EmailChatPage() {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailId, setEmailId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedEmail, setStoredEmail] = useState<EmailMessage | null>(null);
  const [emailThread, setEmailThread] = useState<EmailMessage[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>("gpt-4o");
  const [showEmailContent, setShowEmailContent] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [isReplying, setIsReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Get email ID/thread ID and subject from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const thread = params.get("threadId");
    const subject = params.get("subject") || "E-post";
    const userIdParam = params.get("userId");

    if (!id && !thread) {
      console.error("No email ID or thread ID found in URL");
      setError("No email ID or thread ID found in URL");
      return;
    }

    if (userIdParam) {
      setUserId(userIdParam);
    }

    if (id) {
      setEmailId(id);
      handleSingleEmail(id, subject);
    } else if (thread) {
      setThreadId(thread);
      handleEmailThread(thread, subject);
    }

    setEmailSubject(decodeURIComponent(subject));
  }, []);

  const handleSingleEmail = (id: string, subject: string) => {
    console.log("Loading email with ID:", id);
    setEmailId(id); // Sikre at emailId er satt

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

          // Dobbeltsjekk at vi har en gyldig emailId
          if (parsedEmail.id) {
            setEmailId(parsedEmail.id);
            console.log("Using ID from parsed email:", parsedEmail.id);
          } else {
            console.log("Parsed email missing ID, using URL ID:", id);
          }

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
        checkApiHealth();
      }
    } catch (err) {
      console.error("Error accessing localStorage:", err);
      setError("Error accessing stored email data");
    }
  };

  const handleEmailThread = (threadId: string, subject: string) => {
    console.log("Loading email thread with ID:", threadId);

    // Try to get the saved thread from localStorage
    try {
      const threadKey = `thread_${threadId}`;
      const savedThread = localStorage.getItem(threadKey);

      console.log(
        "Thread in localStorage:",
        savedThread ? "Found" : "Not found"
      );

      if (savedThread) {
        try {
          // Log the raw data to check for serialization issues
          console.log(
            `Raw thread data length: ${savedThread.length} characters`
          );

          const parsedThread = JSON.parse(savedThread);
          console.log("Parsed thread from localStorage:", {
            id: parsedThread.id,
            subject: parsedThread.subject,
            emailCount: parsedThread.emails?.length || 0,
          });

          // Verify email content is complete
          if (parsedThread.emails && parsedThread.emails.length > 0) {
            // Check if body content is preserved after parsing from localStorage
            let contentMissing = false;

            parsedThread.emails.forEach((email: EmailMessage, i: number) => {
              const hasBodyContent = !!email.body?.content;
              const bodyContentLength = email.body?.content?.length || 0;
              const bodyPreviewLength = email.bodyPreview?.length || 0;

              console.log(`Thread email ${i + 1} content check:
                - Subject: ${email.subject || "(No subject)"}
                - From: ${
                  email.from?.emailAddress?.name ||
                  email.from?.emailAddress?.address ||
                  "Unknown"
                } 
                - bodyPreview length: ${bodyPreviewLength}
                - body.content length: ${bodyContentLength}
                - body.content exists: ${hasBodyContent ? "Yes" : "No"}
                - Is sent email: ${email.isSent ? "Yes" : "No"}`);

              if (!hasBodyContent && bodyPreviewLength > 0) {
                contentMissing = true;
                console.warn(
                  `Email ${
                    i + 1
                  } is missing body.content - possible serialization issue`
                );
              }
            });

            if (contentMissing) {
              console.warn(
                "Some emails are missing body content. Email bodies may be truncated."
              );
            }

            // Set the first email as the reference email
            setStoredEmail(parsedThread.emails[0]);
            setEmailThread(parsedThread.emails);
            setError(null);

            // Add initial assistant message about the thread
            setMessages([
              {
                role: "assistant",
                content: `Jeg er klar til å hjelpe deg med e-posttråden "${decodeURIComponent(
                  subject
                )}" som inneholder ${
                  parsedThread.emails.length
                } e-poster. Hva ønsker du hjelp med?`,
              },
            ]);
          } else {
            console.error("Email thread data is missing emails array");
            setError("Email thread data is invalid");
          }
        } catch (parseErr) {
          console.error("Error parsing thread from localStorage:", parseErr);
          setError("Error loading email thread data - invalid format");
        }
      } else {
        checkApiHealth();
      }
    } catch (err) {
      console.error("Error accessing localStorage:", err);
      setError("Error accessing stored email data");
    }
  };

  const checkApiHealth = () => {
    console.log("Checking API health...");
    fetch("/api/health", { credentials: "include" })
      .then((response) => {
        console.log("API health check status:", response.status);
        if (response.ok) {
          setError(
            "Email data not found in local storage. This may be because you're viewing from a different device or browser. Please try accessing the email from your inbox again."
          );
        } else {
          setError(
            `Email data not found. API returned status ${response.status}`
          );
        }
      })
      .catch((error) => {
        console.error("API health check failed:", error);
        setError(
          "Email data not found and API connectivity check failed. Please try again."
        );
      });
  };

  // Handle submitting a message
  const handleSubmit = async (
    message: string,
    attachments?: Microsoft365Resource[]
  ) => {
    if ((!emailId && !threadId) || (!storedEmail && !emailThread)) {
      console.error("Cannot send message without valid email data");
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
      // Make API request
      const response = await fetch("/api/ai-services/email/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: selectedModel,
          emailId: emailId || undefined,
          storedEmail: storedEmail || undefined,
          threadId: threadId || undefined,
          emailThread: emailThread || undefined,
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
          } catch {
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
          } catch {
            console.error("Failed to parse error response");
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

  // Handle sending a reply to the email
  const handleSendReply = async (content: string) => {
    console.log("EmailChatPage.handleSendReply called with: ", {
      emailId: emailId,
      threadId: threadId,
      storedEmailId: storedEmail?.id,
      hasContent: !!content?.trim(),
      contentLength: content?.length || 0,
    });

    // Bruk threadId dersom emailId ikke er tilgjengelig
    const messageId =
      emailId || (storedEmail && storedEmail.id ? storedEmail.id : null);

    if ((!messageId && !threadId) || !content.trim()) {
      console.error("Cannot send reply without email/thread ID or content", {
        hasEmailId: !!messageId,
        hasThreadId: !!threadId,
        hasContent: !!content?.trim(),
      });
      toast({
        title: "Kan ikke sende svar",
        description: "Mangler e-post ID eller innhold",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsReplying(true);
    setReplyError(null);

    try {
      // Bruk det mest relevante ID-et for å svare
      const effectiveId = messageId || threadId;
      const isThread = !messageId && !!threadId;

      console.log(
        `Sending reply using ${
          isThread ? "threadId" : "emailId"
        }: ${effectiveId}, content length: ${content.length}`
      );

      const response = await fetch("/api/ai-services/email/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Viktig for autentisering
        body: JSON.stringify({
          emailId: messageId,
          threadId: threadId,
          isThread: isThread,
          content,
        }),
      });

      console.log(`Reply API response status: ${response.status}`);

      // Få den fullstendige responsen
      const responseText = await response.text();
      let responseData;

      try {
        // Prøv å tolke JSON-responsen
        responseData = JSON.parse(responseText);
        console.log("Reply API response data:", responseData);
      } catch (e) {
        console.error("Failed to parse API response:", e);
        console.error("Raw response:", responseText);
        throw new Error("Serveren returnerte ugyldig respons");
      }

      if (!response.ok) {
        // Vis detaljert feilmelding fra serveren om tilgjengelig
        const errorMessage =
          responseData.error || `Server returnerte feilkode ${response.status}`;
        throw new Error(errorMessage);
      }

      // Håndter den nye action-responsen
      if (
        responseData.action &&
        responseData.action.type === "outlook_redirect"
      ) {
        console.log("Outlook redirect action detected");

        // Returner hele responseData til Chat-komponenten
        return responseData;
      }

      console.log("Reply sent successfully:", responseData);

      toast({
        title: "Svar sendt",
        description:
          "E-posten ble sendt som svar på den opprinnelige meldingen.",
        duration: 3000,
      });

      return responseData;
    } catch (error: any) {
      console.error("Error sending reply:", error);
      const errorMessage =
        error.message || "Det oppstod en feil ved sending av svar";
      setReplyError(errorMessage);
      toast({
        title: "Kunne ikke sende svar",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      throw error;
    } finally {
      setIsReplying(false);
    }
  };

  // Handle model selection
  const handleModelSelect = (model: ModelOption) => {
    setSelectedModel(model);
  };

  // Show email content section with thread or single email
  const renderEmailContent = () => {
    if (emailThread && emailThread.length > 0) {
      return (
        <div className="fixed top-[76px] right-4 z-10 bg-muted/30 p-3 rounded-lg mb-4 max-h-[300px] overflow-y-auto w-[350px] shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">
              E-posttråd ({emailThread.length} e-poster)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowEmailContent(false)}
            >
              Skjul
            </Button>
          </div>
          <div className="space-y-3">
            {emailThread.map((email, index) => (
              <div
                key={index}
                className="border-b border-border pb-2 last:border-0 last:pb-0"
              >
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div>
                    Fra:{" "}
                    {email.from?.emailAddress?.name ||
                      email.from?.emailAddress?.address ||
                      "Ukjent"}
                    {email.isSent && " (Deg)"}
                  </div>
                  <div>{new Date(email.receivedDateTime).toLocaleString()}</div>
                </div>
                <div className="text-sm font-medium mt-1">{email.subject}</div>
                <div
                  className="text-xs text-muted-foreground mt-1 line-clamp-3"
                  dangerouslySetInnerHTML={{
                    __html:
                      email.body?.contentType.includes("html") &&
                      email.body?.content
                        ? email.body.content
                        : email.bodyPreview || "",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    } else if (storedEmail) {
      return (
        <div className="fixed top-[76px] right-4 z-10 bg-muted/30 p-3 rounded-lg mb-4 max-h-[300px] overflow-y-auto w-[350px] shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">E-post</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowEmailContent(false)}
            >
              Skjul
            </Button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <div>
                Fra:{" "}
                {storedEmail.from?.emailAddress?.name ||
                  storedEmail.from?.emailAddress?.address ||
                  "Ukjent"}
              </div>
              <div>
                {new Date(storedEmail.receivedDateTime).toLocaleString()}
              </div>
            </div>
            <div className="text-sm font-medium mt-1">
              {storedEmail.subject}
            </div>
            <div
              className="text-xs text-muted-foreground mt-1"
              dangerouslySetInnerHTML={{
                __html:
                  storedEmail.body?.contentType.includes("html") &&
                  storedEmail.body?.content
                    ? storedEmail.body.content
                    : storedEmail.bodyPreview || "",
              }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  // Header Component
  const HeaderComponent = () => (
    <header className="flex items-center justify-between px-4 py-2 border-b shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Mail className="h-5 w-5 text-primary mr-2" />
          <h1 className="text-lg font-semibold">{emailSubject}</h1>
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

        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setShowEmailContent(!showEmailContent)}
        >
          {showEmailContent ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              Skjul e-post
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              Vis e-post
            </>
          )}
        </Button>

        <button className="text-gray-500 hover:text-gray-700 p-1 rounded">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </header>
  );

  // Render the current email content if it's visible
  const emailContentDisplay = showEmailContent ? renderEmailContent() : null;

  // Log the emailId value to help with debugging
  console.log(`Rendering Chat with emailId: ${emailId || "undefined"}`);

  return (
    <>
      {emailContentDisplay}
      <Chat
        messages={messages}
        onSubmit={handleSubmit}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        error={error}
        headerComponent={<HeaderComponent />}
        assistantName="AI Email Assistant"
        placeholder="Spør om e-posten..."
        userId={userId}
        emailId={
          emailId || storedEmail?.id
            ? String(emailId || storedEmail?.id)
            : undefined
        }
        threadId={threadId ? String(threadId) : undefined}
        onSendReply={handleSendReply}
      />
    </>
  );
}
