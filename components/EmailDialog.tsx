'use client'

import { useState } from 'react'
import { EmailMessage } from '@/lib/microsoft-graph'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, Mail } from 'lucide-react'

interface EmailDialogProps {
  email: EmailMessage
  children: React.ReactNode
}

export function EmailDialog({ email, children }: EmailDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
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
                  onClick={() => window.open(email.webLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open in Outlook</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>{email.from.emailAddress.name || email.from.emailAddress.address}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(email.receivedDateTime).toLocaleString()}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Email body */}
          <div className="text-sm whitespace-pre-wrap">
            {email.bodyPreview}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 