"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmailTile } from "@/components/EmailTile";
import { useUser } from "@/lib/hooks";
import { EmailMessage } from "@/lib/microsoft-graph";
import { Mail, MessageSquare, Bug } from "lucide-react";
import { ApiDebug } from "./ApiDebug";
import { getData, refreshTileData } from "@/app/dashboard/actions";

export default function EmailService() {
  const { user } = useUser();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [showDebug, setShowDebug] = useState(false);

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
        setEmails(data.emails || []);
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
      return true;
    } catch (error) {
      console.error("EmailService: Error refreshing emails:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openChatWithEmail = (email: EmailMessage) => {
    // Save email to localStorage for the chat to use
    try {
      const emailKey = `email_${email.id}`;
      localStorage.setItem(emailKey, JSON.stringify(email));

      // Open the chat page with the email ID
      window.open(
        `/ai-services/email/chat?id=${email.id}&subject=${encodeURIComponent(
          email.subject || "Email"
        )}`,
        "_blank"
      );
    } catch (err) {
      console.error("Failed to save email for chat:", err);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <h1 className="text-2xl font-bold">Email AI Assistant</h1>
      <p className="text-muted-foreground mb-6">
        Få smarte svar på e-postene dine med AI
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email list */}
        <div>
          <h2 className="text-lg font-medium mb-4">Dine siste e-poster</h2>
          <div className="h-[600px] border rounded-md">
            <EmailTile
              emails={emails}
              isLoading={loading}
              refreshInterval={300000}
              onEmailClick={(email) => setSelectedEmail(email)}
              onRefresh={handleRefresh}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="border rounded-md p-6 bg-muted/30 flex flex-col h-[600px]">
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="mb-6 p-4 rounded-full bg-primary/10">
              <MessageSquare className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-3">
              Generer smarte e-postsvar
            </h2>
            <p className="text-center text-muted-foreground mb-6 max-w-md">
              Velg en e-post fra listen til venstre for å åpne en AI-chat som
              kan generere personlige svar basert på e-posttråden.
            </p>
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="font-medium">1</span>
              </div>
              <p>Velg en e-post fra listen</p>
            </div>
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="font-medium">2</span>
              </div>
              <p>Klikk på "Chat om denne e-posten"</p>
            </div>
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="font-medium">3</span>
              </div>
              <p>Be AI-en om å generere et svar</p>
            </div>

            <Button
              disabled={!selectedEmail}
              className="gap-2"
              onClick={() => selectedEmail && openChatWithEmail(selectedEmail)}
            >
              <Mail className="h-4 w-4" />
              {selectedEmail
                ? "Chat om denne e-posten"
                : "Velg en e-post fra listen"}
            </Button>
          </div>
        </div>
      </div>

      {/* Debug section */}
      <div className="mt-10 border-t pt-4">
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
