'use client'

import { useEffect, useState } from 'react'
import { TeamsMessage } from '@/lib/microsoft-graph'
import { fetchMessageThread, sendMessageReply, startNewThread } from '@/app/api/teams/actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, AlertCircle, MessageSquare } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase-browser'
import { useUser } from '@/lib/hooks'

interface TeamsMessageDialogProps {
  message: TeamsMessage
  isOpen: boolean
  onClose: () => void
}

export function TeamsMessageDialog({ message, isOpen, onClose }: TeamsMessageDialogProps) {
  const { user, loading: userLoading } = useUser()
  const [reply, setReply] = useState('')
  const [newThreadMessage, setNewThreadMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [thread, setThread] = useState<TeamsMessage[]>([])
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'reply' | 'new'>('reply')
  const [databaseUserId, setDatabaseUserId] = useState<string | null>(null)

  // Get the database user ID when auth user is available
  useEffect(() => {
    async function getDatabaseUserId() {
      if (!user?.email) return null
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .single()
        
        if (error) throw error
        setDatabaseUserId(data.id)
      } catch (err) {
        console.error('Error getting database user ID:', err)
        setError('Failed to get user information. Please try signing out and back in.')
      }
    }

    if (user?.email) {
      getDatabaseUserId()
    } else {
      setDatabaseUserId(null)
    }
  }, [user?.email])

  useEffect(() => {
    if (isOpen && message && databaseUserId) {
      loadThread()
    } else {
      // Clear state when dialog closes
      setThread([])
      setError(null)
      setReply('')
      setNewThreadMessage('')
      setActiveTab('reply')
    }
  }, [isOpen, message, databaseUserId])

  const loadThread = async () => {
    if (!databaseUserId) return

    setIsLoadingThread(true)
    setError(null)
    try {
      const messages = await fetchMessageThread(databaseUserId, message.id)
      setThread(messages)
    } catch (error: any) {
      console.error('Error loading thread:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoadingThread(false)
    }
  }

  const handleSendReply = async () => {
    if (!reply.trim() || !databaseUserId) return
    
    setIsLoading(true)
    setError(null)
    try {
      await sendMessageReply(databaseUserId, message.id, reply)
      setReply('')
      // Reload the thread to show the new reply
      await loadThread()
    } catch (error: any) {
      console.error('Error sending reply:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartNewThread = async () => {
    if (!newThreadMessage.trim() || !databaseUserId) return
    
    setIsLoading(true)
    setError(null)
    try {
      await startNewThread(
        databaseUserId, 
        message.channelIdentity?.teamId || '', 
        message.channelIdentity?.channelId || '', 
        newThreadMessage
      )
      setNewThreadMessage('')
      onClose() // Close dialog after successfully starting new thread
    } catch (error: any) {
      console.error('Error starting new thread:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const getErrorMessage = (error: any): string => {
    if (error?.message === 'Not authenticated') {
      return 'You need to be signed in to perform this action. Please sign in and try again.'
    }
    if (error?.message === 'Unauthorized') {
      return 'You are not authorized to perform this action.'
    }
    if (error?.message === 'Microsoft connection not found') {
      return 'Your Microsoft account connection is not set up. Please connect your Microsoft account in settings.'
    }
    return 'An unexpected error occurred. Please try again.'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl"
        aria-describedby="message-thread-description"
      >
        <DialogHeader>
          <DialogTitle className="space-y-1">
            <div>
              {message.from?.user?.displayName || 'Unknown User'}
            </div>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              {message.teamDisplayName && (
                <>
                  <span>{message.teamDisplayName}</span>
                  <span>•</span>
                </>
              )}
              {message.channelDisplayName && (
                <span># {message.channelDisplayName}</span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {/* Thread messages */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {isLoadingThread ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : thread.length > 0 ? (
              thread.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`rounded-lg p-4 ${
                    msg.id === message.id ? 'bg-muted/50' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{msg.from?.user?.displayName || 'Unknown User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdDateTime).toLocaleString()}
                    </span>
                  </div>
                  <div 
                    className="text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: msg.content || '' }}
                  />
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                No messages in thread
              </div>
            )}
          </div>

          {/* Reply/New Thread tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'reply' | 'new')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reply">Reply in Thread</TabsTrigger>
              <TabsTrigger value="new">Start New Thread</TabsTrigger>
            </TabsList>
            <TabsContent value="reply" className="space-y-2">
              <Textarea
                placeholder="Type your reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-[100px]"
                disabled={isLoading}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleSendReply} 
                  disabled={!reply.trim() || isLoading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isLoading ? 'Sending...' : 'Reply in Thread'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="new" className="space-y-2">
              <Textarea
                placeholder="Start a new thread..."
                value={newThreadMessage}
                onChange={(e) => setNewThreadMessage(e.target.value)}
                className="min-h-[100px]"
                disabled={isLoading}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleStartNewThread} 
                  disabled={!newThreadMessage.trim() || isLoading}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isLoading ? 'Starting...' : 'Start New Thread'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
} 