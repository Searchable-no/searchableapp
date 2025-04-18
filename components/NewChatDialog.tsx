'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Check, Search, UserPlus, Mail, AlertTriangle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface MicrosoftUser {
  id: string
  displayName: string
  email: string
  userPrincipalName: string
}

interface NewChatDialogProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (chatId: string, chatName: string) => void
}

export function NewChatDialog({ isOpen, onClose, onChatCreated }: NewChatDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<MicrosoftUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<MicrosoftUser[]>([])
  const [chatTopic, setChatTopic] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isPermissionError, setIsPermissionError] = useState(false)

  // Search for users when the search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      setError(null)
      setErrorDetails(null)
      setIsPermissionError(false)

      try {
        const response = await fetch(`/api/teams/search-users?query=${encodeURIComponent(searchTerm)}`)
        
        const data = await response.json()
        
        if (!response.ok) {
          // Sjekk om dette er en tilgangsfeil
          if (response.status === 403 && data.authError) {
            setIsPermissionError(true)
            setError(data.error || 'Manglende tillatelser')
            setErrorDetails(data.details || 'Applikasjonen trenger flere tillatelser for å fungere.')
          } else {
            throw new Error(data.error || `Søk feilet: ${response.status}`)
          }
          setSearchResults([])
          return
        }
        
        setSearchResults(data.users || [])
      } catch (err: any) {
        console.error('Error searching for users:', err)
        setError(err.message || 'Kunne ikke søke etter brukere. Prøv igjen senere.')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(searchUsers, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Handle selecting a user
  const handleSelectUser = (user: MicrosoftUser) => {
    // Check if user is already selected
    if (selectedUsers.some(u => u.id === user.id)) {
      return
    }
    
    setSelectedUsers([...selectedUsers, user])
    setSearchTerm('')
    setSearchResults([])
  }

  // Handle removing a selected user
  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(user => user.id !== userId))
  }

  // Handle creating a new chat
  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      setError('Du må velge minst én bruker å chatte med')
      return
    }

    setIsCreating(true)
    setError(null)
    setErrorDetails(null)
    setIsPermissionError(false)

    try {
      const response = await fetch('/api/teams/create-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          members: selectedUsers.map(user => user.email),
          topic: chatTopic.trim() || ""
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // Sjekk om dette er en tilgangsfeil
        if (response.status === 403 && data.authError) {
          setIsPermissionError(true)
          setError(data.error || 'Manglende tillatelser')
          setErrorDetails(data.details || 'Applikasjonen trenger flere tillatelser for å fungere.')
        } else {
          throw new Error(data.error || `Forespørselen feilet: ${response.status}`)
        }
        return
      }
      
      if (data.success && data.chat) {
        onChatCreated(data.chat.id, data.chat.topic)
        resetForm()
      } else {
        throw new Error('Uventet svar fra serveren')
      }
    } catch (err: any) {
      console.error('Error creating chat:', err)
      setError(err.message || 'Kunne ikke opprette chat. Prøv igjen senere.')
      if (err.details) {
        setErrorDetails(err.details)
      }
    } finally {
      setIsCreating(false)
    }
  }

  // Reset form state
  const resetForm = () => {
    setSelectedUsers([])
    setChatTopic('')
    setSearchTerm('')
    setSearchResults([])
    setError(null)
    setErrorDetails(null)
    setIsPermissionError(false)
  }

  // Handle dialog close
  const handleDialogClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opprett ny Teams-chat</DialogTitle>
          <DialogDescription>
            Opprett en ny chat for å dele filen med en eller flere brukere
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant={isPermissionError ? "destructive" : "default"} className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-semibold">{error}</AlertTitle>
            {errorDetails && (
              <AlertDescription>
                {errorDetails}
                {isPermissionError && (
                  <div className="mt-2">
                    <a 
                      href="https://docs.microsoft.com/en-us/graph/permissions-reference" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center text-sm font-medium underline underline-offset-4"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Les mer om Microsoft Graph API tillatelser
                    </a>
                  </div>
                )}
              </AlertDescription>
            )}
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="chat-topic">Chattnavn (valgfritt)</Label>
            <Input 
              id="chat-topic"
              placeholder="Angi et navn for chatten" 
              value={chatTopic}
              onChange={e => setChatTopic(e.target.value)}
            />
          </div>

          <div>
            <Label>Deltakere</Label>
            <div className="flex items-center space-x-2 mt-1.5 mb-2">
              <div className="relative flex-1">
                <Input 
                  placeholder="Søk etter brukere..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pr-8"
                  disabled={isPermissionError}
                />
                {isSearching ? (
                  <Loader2 className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Display selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1 pr-1.5">
                    <Mail className="h-3 w-3 mr-0.5" />
                    <span>{user.displayName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-muted"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Fjern</span>
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Search results */}
            {searchTerm.length >= 2 && !isPermissionError && (
              <ScrollArea className="h-40 rounded-md border">
                {isSearching ? (
                  <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="p-1">
                    {searchResults.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div className="overflow-hidden">
                            <div className="font-medium text-sm truncate">{user.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span className="sr-only">Legg til</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Ingen brukere funnet. Prøv et annet søkeord.
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={handleDialogClose}
          >
            Avbryt
          </Button>
          <Button 
            disabled={selectedUsers.length === 0 || isCreating || isPermissionError}
            onClick={handleCreateChat}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Oppretter...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Opprett chat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 