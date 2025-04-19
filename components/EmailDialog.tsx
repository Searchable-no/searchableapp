"use client";

import { useState, useEffect, useRef } from "react";
import { EmailMessage } from "@/lib/microsoft-graph";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Info } from "lucide-react";
import { markEmailAsRead } from "@/lib/microsoft-graph";
import { useUser } from "@/lib/hooks";

interface EmailDialogProps {
  email: EmailMessage;
  thread?: EmailMessage[];
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export function EmailDialog({
  email,
  thread = [],
  isOpen,
  onClose,
  isLoading = false,
}: EmailDialogProps) {
  const { user } = useUser();
  const [emailThread, setEmailThread] = useState<EmailMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasProcessedData = useRef(false);

  // Process thread data only once per dialog open session
  useEffect(() => {
    if (!isOpen) {
      hasProcessedData.current = false;
      return;
    }

    // Only process thread data once per dialog session
    if (!hasProcessedData.current) {
      console.log("EmailDialog: Thread data received:", { 
        threadLength: thread?.length,
        hasBody: !!thread?.[0]?.body,
        firstBodyLength: thread?.[0]?.body?.content?.length || 0,
        previewLength: thread?.[0]?.bodyPreview?.length || 0 
      });
      
      // If we have emails in the thread, use them, otherwise just use the current email
      if (thread && thread.length > 0) {
        // Ensure all emails have body content by creating synthetic content from preview if needed
        const threadsWithBody = thread.map(email => {
          if (!email.body?.content && email.bodyPreview) {
            return {
              ...email,
              body: {
                content: `<div>${email.bodyPreview}</div>`,
                contentType: 'html'
              }
            };
          }
          return email;
        });
        setEmailThread(threadsWithBody);
        setError(null);
      } else {
        // Ensure the single email has body content
        const singleEmailWithBody = {
          ...email,
          body: email.body || {
            content: `<div>${email.bodyPreview || "Ingen innhold tilgjengelig"}</div>`,
            contentType: 'html'
          }
        };
        setEmailThread([singleEmailWithBody]);
        
        if (!email.body?.content && !email.bodyPreview) {
          setError("Kunne ikke hente e-postinnhold. Viser kun tilgjengelig metadata.");
        } else {
          setError(null);
        }
      }
      
      hasProcessedData.current = true;
    }
  }, [isOpen, email, thread]);

  // Mark as read effect with proper dependencies
  useEffect(() => {
    // Only execute when dialog is opened
    if (!isOpen || !user?.id || !email?.id || email?.isRead) {
      return;
    }

    const markRead = async () => {
      try {
        await markEmailAsRead(user.id, email.id);
      } catch (error) {
        console.error("Error while marking email as read:", error);
      }
    };

    markRead();
  }, [isOpen, user?.id, email?.id, email?.isRead]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="line-clamp-1">{email.subject}</span>
              {email.webLink && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(email.webLink, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open in Outlook</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>
                {email.from?.emailAddress?.name ||
                  email.from?.emailAddress?.address ||
                  "Unknown Sender"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(email.receivedDateTime).toLocaleString()}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-4 rounded-lg mb-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                </div>
              )}
              
              {emailThread && emailThread.length > 0 ? (
                emailThread.map((email, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                        {email.from?.emailAddress?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="font-medium">{email.from?.emailAddress?.name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">{email.from?.emailAddress?.address || ""}</div>
                      </div>
                      <div className="ml-auto text-sm text-muted-foreground">
                        {email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleString() : ""}
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      {email.body?.content ? (
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: email.body.content }}
                        />
                      ) : (
                        <p className="text-muted-foreground italic">
                          {email.bodyPreview ? (
                            <div dangerouslySetInnerHTML={{ __html: `<div>${email.bodyPreview}</div>` }} />
                          ) : (
                            "Ingen innhold tilgjengelig"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Unable to load email content</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex justify-end gap-2">
          {email.webLink && (
            <Button onClick={() => window.open(email.webLink, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Outlook
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
