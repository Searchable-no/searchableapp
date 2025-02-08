"use client";

import { useState, useEffect } from "react";
import { EmailMessage } from "@/lib/microsoft-graph";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail } from "lucide-react";
import { markEmailAsRead } from "@/lib/microsoft-graph";
import { useUser } from "@/lib/hooks";

interface EmailDialogProps {
  email: EmailMessage;
  children: React.ReactNode;
  onEmailRead?: () => void;
}

export function EmailDialog({
  email,
  children,
  onEmailRead,
}: EmailDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    const markRead = async () => {
      if (open && !email.isRead && user?.id) {
        try {
          const success = await markEmailAsRead(user.id, email.id);
          if (success && onEmailRead) {
            onEmailRead();
          } else if (!success) {
            // If marking as read failed, we'll still show the email content
            // but won't update the read status
            console.warn(
              "Failed to mark email as read, but continuing to show content"
            );
          }
        } catch (error) {
          console.error("Error while marking email as read:", error);
        }
      }
    };

    markRead();
  }, [open, email.isRead, email.id, user?.id, onEmailRead]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
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

        <div className="space-y-4">
          {/* Email body */}
          <div className="text-sm whitespace-pre-wrap">{email.bodyPreview}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
