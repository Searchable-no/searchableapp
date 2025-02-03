'use client'

import { TeamsChannelMessage } from '@/lib/microsoft-graph'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { TeamsMessageDialog } from '@/components/TeamsMessageDialog'

interface TeamsChannelTileProps {
  messages: TeamsChannelMessage[]
  isLoading: boolean
  userId: string
}

function formatMessageContent(content: string): string {
  const withoutTags = content.replace(/<[^>]*>/g, '')
  const withoutExtraSpaces = withoutTags.replace(/\s+/g, ' ')
  const withoutLinks = withoutExtraSpaces.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
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
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }
  
  return date.toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'short'
  })
}

function groupMessagesByTeam(messages: TeamsChannelMessage[]) {
  const groups: { [key: string]: { [key: string]: TeamsChannelMessage[] } } = {}
  
  messages.forEach(message => {
    if (!groups[message.teamName]) {
      groups[message.teamName] = {}
    }
    if (!groups[message.teamName][message.channelName]) {
      groups[message.teamName][message.channelName] = []
    }
    groups[message.teamName][message.channelName].push(message)
  })
  
  return groups
}

export function TeamsChannelTile({ messages, isLoading, userId }: TeamsChannelTileProps) {
  const [showAll, setShowAll] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<TeamsChannelMessage | null>(null)
  const displayMessages = showAll ? messages : messages.slice(0, 5)
  const groupedMessages = groupMessagesByTeam(displayMessages)

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Teams Channels
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-auto max-h-[250px]">
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded bg-muted"></div>
            <div className="h-14 animate-pulse rounded bg-muted"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Teams Channels
          </div>
          {messages.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs px-2"
              onClick={() => window.open('https://teams.microsoft.com', '_blank')}
            >
              Open Teams
              <ChevronRight className="ml-1 h-2 w-2" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        <div className="space-y-1">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent messages</p>
          ) : (
            <>
              <div className="space-y-1">
                {Object.entries(groupedMessages).map(([teamName, channels]) => (
                  <div key={teamName} className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      {teamName}
                    </h3>
                    {Object.entries(channels).map(([channelName, channelMessages]) => (
                      <div key={`${teamName}-${channelName}`} className="space-y-1 pl-3">
                        <h4 className="text-[10px] font-medium text-muted-foreground">
                          # {channelName}
                        </h4>
                        {channelMessages.map((message) => (
                          <div 
                            key={message.id} 
                            className="group relative rounded-sm border p-1.5 hover:bg-muted/50 cursor-pointer"
                            onClick={() => setSelectedMessage(message)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium truncate">
                                {message.from?.user?.displayName || 'Unknown User'}
                              </p>
                              <div className="flex items-center gap-1">
                                {message.webUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(message.webUrl, '_blank')
                                    }}
                                  >
                                    <ExternalLink className="h-2 w-2" />
                                    <span className="sr-only">Open in Teams</span>
                                  </Button>
                                )}
                                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDate(message.createdDateTime)}
                                </p>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {formatMessageContent(message.content)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {messages.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-6"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show ${messages.length - 5} More`}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
      {selectedMessage && (
        <TeamsMessageDialog
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          userId={userId}
        />
      )}
    </Card>
  )
} 