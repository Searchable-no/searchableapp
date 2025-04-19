"use client";

import { useState, useEffect, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmailMessage } from "@/lib/microsoft-graph";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Skeleton } from "@/components/ui/skeleton";

type NotificationType = 'email' | 'teams_message' | 'teams_channel';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  timestamp: string;
  sender: string;
  isRead: boolean;
  url?: string;
  originalData: any;
}

interface NotificationBellProps {
  emails?: any[];
  teamsMessages?: any[];
  channelMessages?: any[];
}

export function NotificationBell({ 
  emails = [], 
  teamsMessages = [], 
  channelMessages = []
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [isGeneratingAISummary, setIsGeneratingAISummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const [localEmails, setLocalEmails] = useState(emails);
  const [localTeamsMessages, setLocalTeamsMessages] = useState(teamsMessages);
  const [localChannelMessages, setLocalChannelMessages] = useState(channelMessages);

  // Update local state when props change - with deep comparison
  useEffect(() => {
    if (JSON.stringify(localEmails) !== JSON.stringify(emails)) {
      setLocalEmails(emails);
    }
  }, [emails]);

  useEffect(() => {
    if (JSON.stringify(localTeamsMessages) !== JSON.stringify(teamsMessages)) {
      setLocalTeamsMessages(teamsMessages);
    }
  }, [teamsMessages]);

  useEffect(() => {
    if (JSON.stringify(localChannelMessages) !== JSON.stringify(channelMessages)) {
      setLocalChannelMessages(channelMessages);
    }
  }, [channelMessages]);

  // Convert different notification types to a unified format
  const notifications = useMemo(() => {
    const result: Notification[] = [];
    
    // Add email notifications - only unread ones
    localEmails.forEach(email => {
      // Email is unread if the isRead property is explicitly false
      if (email.isRead === false) {
        result.push({
          id: email.id,
          type: 'email',
          title: email.subject || 'Ingen emne',
          content: email.bodyPreview || '',
          timestamp: email.receivedDateTime,
          sender: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Ukjent avsender',
          isRead: false,
          url: email.webLink,
          originalData: email
        });
      }
    });
    
    // Add Teams chat notifications - only unread ones
    localTeamsMessages.forEach(message => {
      // Teams message is unread if the isRead property is explicitly false
      if (message.isRead === false) {
        result.push({
          id: message.id,
          type: 'teams_message',
          title: `Melding fra ${message.from?.user?.displayName || 'ukjent'}`,
          content: message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || 'Ingen innhold',
          timestamp: message.createdDateTime,
          sender: message.from?.user?.displayName || 'Ukjent bruker',
          isRead: false,
          url: message.webUrl,
          originalData: message
        });
      }
    });
    
    // Add Teams channel notifications - only unread ones
    localChannelMessages.forEach(message => {
      // Channel message is unread if the isRead property is explicitly false
      if (message.isRead === false) {
        result.push({
          id: message.id,
          type: 'teams_channel',
          title: `${message.teamName} > ${message.channelName}`,
          content: message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || 'Ingen innhold',
          timestamp: message.createdDateTime,
          sender: message.from?.user?.displayName || 'Ukjent bruker',
          isRead: false,
          url: message.webUrl,
          originalData: message
        });
      }
    });
    
    // Sort by timestamp (newest first)
    return result.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [localEmails, localTeamsMessages, localChannelMessages]);

  // Reset AI summary when popover is closed
  useEffect(() => {
    if (!open) {
      setAiSummary(null);
    }
  }, [open]);

  const handleGenerateAISummary = async () => {
    if (notifications.length === 0) return;
    
    setIsGeneratingAISummary(true);
    
    try {
      // Prepare notifications data
      const notificationsData = notifications.map(n => ({
        type: n.type,
        title: n.title,
        content: n.content,
        sender: n.sender,
        timestamp: n.timestamp
      }));
      
      // Call the API to generate summary
      const response = await fetch('/api/ai/summarize-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notifications: notificationsData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const data = await response.json();
      setAiSummary(data.summary);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setAiSummary('Kunne ikke generere sammendrag. Prøv igjen senere.');
    } finally {
      setIsGeneratingAISummary(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read locally
    markAsRead(notification);
    
    // Open the notification in its native app
    if (notification.url) {
      window.open(notification.url, '_blank');
    }
  };

  const markAsRead = (notification: Notification) => {
    // Mark as read in local state based on type
    switch (notification.type) {
      case 'email':
        setLocalEmails(prevEmails => 
          prevEmails.map(email => 
            email.id === notification.id ? { ...email, isRead: true } : email
          )
        );
        break;
      case 'teams_message':
        setLocalTeamsMessages(prevMessages => 
          prevMessages.map(message => 
            message.id === notification.id ? { ...message, isRead: true } : message
          )
        );
        break;
      case 'teams_channel':
        setLocalChannelMessages(prevMessages => 
          prevMessages.map(message => 
            message.id === notification.id ? { ...message, isRead: true } : message
          )
        );
        break;
    }

    // In a real implementation, you would also make an API call here
    // to mark the notification as read on the server
    console.log(`Marked notification ${notification.id} as read`);

    // TODO: Implement API call to update read status on server
    // This would require adding an endpoint in the API
  };

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'email':
        return (
          <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
            E
          </div>
        );
      case 'teams_message':
        return (
          <div className="flex-shrink-0 h-8 w-8 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">
            T
          </div>
        );
      case 'teams_channel':
        return (
          <div className="flex-shrink-0 h-8 w-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">
            C
          </div>
        );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative flex items-center gap-1.5"
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-medium">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex flex-col max-h-[70vh]">
          <div className="p-4 border-b">
            <h3 className="font-medium">Varsler</h3>
            <p className="text-xs text-muted-foreground">
              {notifications.length > 0 
                ? `Du har ${notifications.length} uleste varsler`
                : 'Ingen nye varsler'}
            </p>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <p>Ingen uleste varsler å vise.</p>
                <p className="mt-2">For å se de siste oppdateringene, ta en titt på dashboardet ditt.</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {notifications.map((notification) => (
                  <div
                    key={`${notification.type}-${notification.id}`}
                    className="p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-2">
                      {getIconForType(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: nb })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notification.sender}
                        </p>
                        <p className="text-xs mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {isGeneratingAISummary && (
              <div className="p-4 border-t">
                <h4 className="text-sm font-medium mb-2">Genererer sammendrag...</h4>
                <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm">
                  <div className="space-y-4">
                    <Skeleton className="w-full h-6" />
                    <Skeleton className="w-3/4 h-4" />
                    <Skeleton className="w-5/6 h-4" />
                    <div className="space-y-2 mt-4">
                      <Skeleton className="w-full h-5" />
                      <Skeleton className="w-full h-4" />
                      <Skeleton className="w-5/6 h-4" />
                    </div>
                    <div className="space-y-2 mt-4">
                      <Skeleton className="w-full h-5" />
                      <Skeleton className="w-full h-4" />
                      <Skeleton className="w-5/6 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {aiSummary && !isGeneratingAISummary && (
              <div className="p-4 border-t">
                <h4 className="text-sm font-medium mb-2">AI Sammendrag</h4>
                <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm">
                  <div className="prose prose-sm max-w-none dark:prose-invert 
                    prose-headings:mb-4 prose-headings:mt-6 first:prose-headings:mt-0
                    prose-p:my-3 prose-p:leading-relaxed
                    prose-li:my-1 prose-li:leading-relaxed
                    prose-ol:my-2 prose-ul:my-2
                    whitespace-pre-line">
                    <ReactMarkdown>
                      {aiSummary}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom action area */}
          {notifications.length > 0 && !aiSummary && !isGeneratingAISummary && (
            <div className="p-4 border-t">
              <Button 
                className="w-full"
                onClick={handleGenerateAISummary}
                disabled={isGeneratingAISummary}
              >
                {isGeneratingAISummary ? (
                  <>
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                    Genererer sammendrag...
                  </>
                ) : (
                  'Oppsumer med AI'
                )}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
} 