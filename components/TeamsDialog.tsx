'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Mail, Loader2, Info, UserCircle2, Plus } from 'lucide-react'
import { getTeams, getGroups, getMembers } from '@/app/api/teams/actions'
import { Team, Group, TeamMember } from '@/lib/microsoft-graph'
import { useUser } from '@/lib/hooks'
import { supabase } from '@/lib/supabase-browser'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface TeamsDialogProps {
  isOpen: boolean
  onClose: () => void
}

const AddMemberDialog = ({ 
  isOpen, 
  onClose, 
  onAddMember 
}: { 
  isOpen: boolean, 
  onClose: () => void,
  onAddMember: (email: string) => Promise<void>
}) => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onAddMember(email)
      onClose()
      setEmail('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add member')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Enter the email address of the user you want to add to the team
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsDialog({ isOpen, onClose }: TeamsDialogProps) {
  const { user, loading: userLoading } = useUser()
  const [personalTeams, setPersonalTeams] = useState<Team[]>([])
  const [orgTeams, setOrgTeams] = useState<Team[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'teams' | 'groups'>('teams')
  const [databaseUserId, setDatabaseUserId] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)

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
    // Reset state when dialog opens/closes
    if (!isOpen) {
      setPersonalTeams([])
      setOrgTeams([])
      setGroups([])
      setError(null)
      setSelectedTeam(null)
      setTeamMembers([])
      return
    }

    // Don't fetch if user is loading or no database user ID
    if (userLoading || !databaseUserId) {
      setIsLoading(false)
      setError(userLoading ? 'Loading user session...' : 'User session not found. Please sign in again.')
      return
    }

    fetchData()
  }, [isOpen, databaseUserId, userLoading])

  const fetchData = async () => {
    if (!databaseUserId) return

    setIsLoading(true)
    setError(null)

    try {
      if (activeTab === 'teams') {
        const teams = await getTeams(databaseUserId)
        setPersonalTeams(teams.filter((team: Team) => team.visibility !== 'public'))
        setOrgTeams(teams.filter((team: Team) => team.visibility === 'public'))
      } else {
        const fetchedGroups = await getGroups(databaseUserId)
        setGroups(fetchedGroups)
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamMembers = async (team: Team) => {
    if (!databaseUserId) return

    setIsLoadingMembers(true)
    setError(null)

    try {
      const members = await getMembers(databaseUserId, team.id)
      setTeamMembers(members)
    } catch (error: any) {
      console.error('Error fetching team members:', error)
      setError(getErrorMessage(error))
    } finally {
      setIsLoadingMembers(false)
    }
  }

  useEffect(() => {
    if (selectedTeam && databaseUserId) {
      fetchTeamMembers(selectedTeam)
    }
  }, [selectedTeam, databaseUserId])

  const getErrorMessage = (error: any): string => {
    if (error?.message === 'Not authenticated') {
      return 'You need to be signed in to perform this action. Please sign in and try again.'
    }
    if (error?.message === 'Unauthorized') {
      return 'You are not authorized to perform this action. Please try signing out and back in.'
    }
    if (error?.message === 'Microsoft connection not found') {
      return 'Your Microsoft account connection is not set up. Please connect your Microsoft account in settings.'
    }
    return 'An unexpected error occurred. Please try again.'
  }

  const TeamsList = ({ teams }: { teams: Team[] }) => (
    <div className="space-y-2">
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No teams found
        </p>
      ) : (
        teams.map((team) => (
          <div
            key={team.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50"
          >
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => window.open(`https://teams.microsoft.com/l/team/${team.id}`, '_blank')}
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium leading-none mb-1">
                    {team.displayName}
                  </h3>
                  {team.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {team.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => setSelectedTeam(team)}
            >
              <Info className="h-4 w-4" />
              <span className="sr-only">View team details</span>
            </Button>
          </div>
        ))
      )}
    </div>
  )

  const GroupsList = ({ groups }: { groups: Group[] }) => (
    <div className="space-y-2">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No groups found
        </p>
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
            onClick={() => window.open(`https://outlook.office.com/mail/group/${group.mail}`, '_blank')}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium leading-none mb-1">
                {group.displayName}
              </h3>
              {group.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {group.description}
                </p>
              )}
              {group.mail && (
                <p className="text-xs text-muted-foreground mt-1">
                  {group.mail}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )

  const TeamDetails = ({ team, members, isLoading, onClose }: { team: Team, members: TeamMember[], isLoading: boolean, onClose: () => void }) => (
    <Sheet open={!!team} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            {team.displayName}
          </SheetTitle>
          <SheetDescription>
            {team.description || 'No description available'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Team Info Section */}
          <div>
            <h3 className="text-sm font-medium mb-2">Team Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Visibility</span>
                <span className="capitalize">{team.visibility}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(team.createdDateTime).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Member Count</span>
                <span>{members.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(`https://teams.microsoft.com/l/team/${team.id}`, '_blank')}
              >
                Open in Teams
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(`https://teams.microsoft.com/_#/files/${team.id}`, '_blank')}
              >
                View Files
              </Button>
            </div>
          </div>

          {/* Members Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Team Members</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsAddMemberOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <UserCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email || member.userPrincipalName}</p>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {member.roles?.includes('owner') ? 'Owner' : 'Member'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )

  const handleAddMember = async (email: string) => {
    if (!selectedTeam || !databaseUserId) return

    try {
      const response = await fetch('/api/teams/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          memberEmail: email,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add member')
      }

      // Refresh the members list
      await fetchTeamMembers(selectedTeam)
      toast.success('Team member added successfully')
    } catch (error: any) {
      console.error('Error adding team member:', error)
      throw error
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Microsoft Teams & Groups</DialogTitle>
            <DialogDescription>
              View and access your Microsoft Teams and Microsoft 365 Groups
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'teams' | 'groups')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <TabsContent value="teams" className="mt-4">
                    <Tabs defaultValue="personal" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="personal">My Teams</TabsTrigger>
                        <TabsTrigger value="org">Organization Teams</TabsTrigger>
                      </TabsList>
                      <TabsContent value="personal" className="mt-4">
                        <TeamsList teams={personalTeams} />
                      </TabsContent>
                      <TabsContent value="org" className="mt-4">
                        <TeamsList teams={orgTeams} />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                  <TabsContent value="groups" className="mt-4">
                    <GroupsList groups={groups} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {selectedTeam && (
        <>
          <TeamDetails 
            team={selectedTeam}
            members={teamMembers}
            isLoading={isLoadingMembers}
            onClose={() => setSelectedTeam(null)}
          />
          <AddMemberDialog
            isOpen={isAddMemberOpen}
            onClose={() => setIsAddMemberOpen(false)}
            onAddMember={handleAddMember}
          />
        </>
      )}
    </>
  )
} 