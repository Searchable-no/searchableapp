'use client'

import { TeamsMessage } from '@/lib/microsoft-graph'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MessageSquare, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { TeamsMessageDialog } from '@/components/TeamsMessageDialog'
import { formatDistanceToNow } from 'date-fns'

interface TeamsMessageTileProps {
  messages: TeamsMessage[]
  isLoading: boolean
}

function formatMessageContent(content: string): string {
  // Remove HTML tags
  const withoutTags = content.replace(/<[^>]*>/g, '')
  
  // Replace multiple spaces with a single space
  const withoutExtraSpaces = withoutTags.replace(/\s+/g, ' ')
  
  // Replace markdown-style links [text](url) with just the text
  const withoutLinks = withoutExtraSpaces.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  
  // Decode HTML entities
  const decoded = withoutLinks
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  return decoded.trim()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // If the message is from today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  // If the message is from yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }
  
  // For older messages
  return date.toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'short'
  })
}

function groupMessagesByTeam(messages: TeamsMessage[]) {
  const groups: { [key: string]: TeamsMessage[] } = {}
  
  messages.forEach(message => {
    const key = message.teamDisplayName || message.channelDisplayName || 'Other'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(message)
  })
  
  return groups
}

export function TeamsMessageTile({ messages, isLoading }: TeamsMessageTileProps) {
  const [selectedMessage, setSelectedMessage] = useState<TeamsMessage | null>(null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Teams Messages</CardTitle>
        <CardDescription className="text-xs">Recent messages from your Teams chats</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No recent messages</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedMessage(message)}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium truncate">
                        {message.from?.user?.displayName || 'Unknown User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdDateTime))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {message.content ? formatMessageContent(message.content) : ''}
                    </p>
                    {message.channelDisplayName && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        # {message.channelDisplayName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
      {selectedMessage && (
        <TeamsMessageDialog
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </Card>
  )
} 