'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ChevronRight, ExternalLink, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { EmailMessage } from '@/lib/microsoft-graph'
import { EmailDialog } from '@/components/EmailDialog'
import { formatDistanceToNow } from '@/lib/utils'
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh'
import { cn } from '@/lib/utils'

interface EmailTileProps {
  emails: EmailMessage[]
  isLoading?: boolean
  refreshInterval?: number
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // If the email is from today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  // If the email is from yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }
  
  // For older emails
  return date.toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'short'
  })
}

export function EmailTile({ emails: initialEmails = [], isLoading, refreshInterval = 300000 }: EmailTileProps) {
  const [emails, setEmails] = useState<EmailMessage[]>(initialEmails)
  const [showAll, setShowAll] = useState(false)
  const displayEmails = showAll ? emails : emails.slice(0, 5)
  
  const { isRefreshing, lastRefreshed, refresh } = useAutoRefresh({
    refreshInterval,
    onRefresh: async () => {
      try {
        const response = await fetch('/api/emails/recent')
        if (!response.ok) throw new Error('Failed to fetch emails')
        const data = await response.json()
        setEmails(data.emails)
      } catch (error) {
        console.error('Error refreshing emails:', error)
      }
    }
  })

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Recent Emails
            </div>
            <div className="h-6 w-20 animate-pulse rounded bg-muted"></div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-auto max-h-[250px]">
          <div className="space-y-2">
            <div className="h-[72px] animate-pulse rounded bg-muted"></div>
            <div className="h-[72px] animate-pulse rounded bg-muted"></div>
            <div className="h-[72px] animate-pulse rounded bg-muted"></div>
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
            <Mail className="h-3 w-3" />
            Recent Emails
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Updated {formatDistanceToNow(lastRefreshed)} ago
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => refresh()}
              disabled={isRefreshing}
            >
              <RotateCw className={cn(
                "h-3 w-3",
                isRefreshing && "animate-spin"
              )} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        {emails.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No recent emails
          </div>
        ) : (
          <div className="space-y-2">
            {displayEmails.map((email) => (
              <EmailDialog key={email.id} email={email}>
                <div className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm truncate",
                        !email.isRead && "font-medium"
                      )}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.from.emailAddress.name || email.from.emailAddress.address}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(email.receivedDateTime))} ago
                      </p>
                    </div>
                  </div>
                </div>
              </EmailDialog>
            ))}
            {emails.length > 5 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs h-6"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show ${emails.length - 5} More`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 