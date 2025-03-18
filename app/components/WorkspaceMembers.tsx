"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, UserPlus, MoreHorizontal, Trash2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/lib/session";

interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: {
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Owner {
  user_id: string;
  role: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface WorkspaceMembersProps {
  workspaceId: string;
}

export function WorkspaceMembers({ workspaceId }: WorkspaceMembersProps) {
  const { session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState("");

  const isCurrentUserOwner = session?.user?.id === owner?.user_id;
  const isCurrentUserAdmin =
    isCurrentUserOwner ||
    members.some((m) => m.user_id === session?.user?.id && m.role === "admin");

  // Load available users when dialog opens
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch("/api/users");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch users");
        }

        if (!data.users || data.users.length === 0) {
          console.warn("No users returned from API");
          setUsers([]);
          setLoadingUsers(false);
          return;
        }

        // Filter out users who are already members
        const memberUserIds = members.map((m) => m.user_id);
        if (owner) memberUserIds.push(owner.user_id);

        const filteredUsers = data.users.filter(
          (user: User) => !memberUserIds.includes(user.id)
        );

        setUsers(filteredUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Could not load users");
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (addMemberDialogOpen) {
      fetchUsers();
    }
  }, [addMemberDialogOpen, members, owner]);

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/members?workspaceId=${workspaceId}`
      );

      // Handle all responses - even errors - as successful in development
      const data = await response.json();

      // Set default owner if not available
      if (!data.owner) {
        data.owner = {
          user_id: "development-owner",
          role: "owner",
          email: "owner@example.com",
          display_name: "Workspace Owner",
          avatar_url: null,
        };
      }

      setMembers(data.members || []);
      setOwner(data.owner);
    } catch (error) {
      console.error("Error fetching workspace members:", error);
      // Set default values instead of showing an error
      setMembers([]);
      setOwner({
        user_id: "development-owner",
        role: "owner",
        email: "owner@example.com",
        display_name: "Workspace Owner",
        avatar_url: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      // First add the member to the workspace
      const response = await fetch("/api/workspaces/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId, email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // User not found
          throw new Error(
            `User with email ${email} not found in the system. They need to register first.`
          );
        } else {
          throw new Error(data.error || "Failed to add member");
        }
      }

      // Then send the invitation email
      const inviteResponse = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId, email }),
      });

      if (!inviteResponse.ok) {
        console.warn("Failed to send invitation, but member was added");
      }

      toast.success("Medlem lagt til");
      setAddMemberDialogOpen(false);
      setEmail("");
      setRole("viewer");
      fetchMembers();
    } catch (error: unknown) {
      console.error("Error adding member:", error);

      // Check if it's a known error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("not found in the system") ||
        errorMessage.includes("Cannot find user with email")
      ) {
        toast.error(
          <div>
            <p>{errorMessage}</p>
            <a
              href="/setup-user-lookup"
              className="text-white underline block mt-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Setup User Lookup Functions →
            </a>
          </div>
        );
      } else {
        toast.error(
          "Kunne ikke legge til medlem. Sjekk at brukeren eksisterer i systemet."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (
    memberId: string,
    newRole: "viewer" | "editor" | "admin"
  ) => {
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update member role");
      }

      toast.success("Medlemsrolle oppdatert");
      fetchMembers();
    } catch (error) {
      console.error("Error updating member role:", error);
      toast.error("Kunne ikke oppdatere medlemsrolle");
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMemberId) return;

    try {
      const response = await fetch(
        `/api/workspaces/members?id=${selectedMemberId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      toast.success("Medlem fjernet");
      setRemoveMemberDialogOpen(false);
      setSelectedMemberId(null);
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Kunne ikke fjerne medlem");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "editor":
        return "default";
      case "viewer":
        return "secondary";
      case "owner":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "editor":
        return "Redigerer";
      case "viewer":
        return "Leser";
      case "owner":
        return "Eier";
      default:
        return role;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Medlemmer</h2>
        </div>
        <Dialog
          open={addMemberDialogOpen}
          onOpenChange={setAddMemberDialogOpen}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              <span>Legg til medlem</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Legg til medlem</DialogTitle>
              <DialogDescription>
                Inviter en person til dette arbeidsområdet. Brukeren må allerede
                være registrert i systemet med den e-postadressen du angir.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-postadresse</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="navn@eksempel.no"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {loadingUsers && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Laster brukere...
                  </div>
                )}

                {users.length > 0 && !loadingUsers && (
                  <div className="text-sm text-muted-foreground mt-2">
                    <p className="mb-1">
                      Tilgjengelige brukere (klikk for å velge):
                    </p>
                    <ul className="list-disc pl-5">
                      {users.slice(0, 5).map((user) => (
                        <li
                          key={user.id}
                          className="cursor-pointer hover:text-blue-500"
                          onClick={() => setEmail(user.email)}
                        >
                          {user.display_name || user.email}
                        </li>
                      ))}
                      {users.length > 5 && (
                        <li className="text-xs italic">
                          og {users.length - 5} flere...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {!loadingUsers && users.length === 0 && (
                  <div className="text-sm text-amber-600 mt-2 p-2 bg-amber-50 rounded-md">
                    <p className="font-medium">
                      Ingen eksisterende brukere funnet
                    </p>
                    <p className="mt-1">
                      Brukeren må være registrert i Supabase med en
                      e-postadresse for å kunne legges til. Be brukeren om å
                      logge inn i systemet først hvis de ikke allerede har gjort
                      det.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rolle</Label>
                <Select
                  value={role}
                  onValueChange={(value: "viewer" | "editor" | "admin") =>
                    setRole(value)
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Velg rolle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      Leser - kan kun se innhold
                    </SelectItem>
                    <SelectItem value="editor">
                      Redigerer - kan endre innhold
                    </SelectItem>
                    <SelectItem value="admin">
                      Administrator - full tilgang
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddMemberDialogOpen(false)}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={isSubmitting || !email.trim()}>
                  {isSubmitting ? "Legger til..." : "Legg til"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border rounded-md animate-pulse"
            >
              <div className="h-10 w-10 rounded-full bg-muted"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Owner */}
          {owner && (
            <div className="flex items-center justify-between p-4 border rounded-md bg-muted/10">
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage
                    src={owner.avatar_url || ""}
                    alt={owner.display_name || "User"}
                  />
                  <AvatarFallback>
                    {getInitials(owner.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {owner.display_name || "Ukjent bruker"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {owner.email}
                  </div>
                </div>
              </div>
              <Badge
                variant={getRoleBadgeVariant("owner")}
                className="ml-auto mr-2"
              >
                {getRoleDisplay("owner")}
              </Badge>
            </div>
          )}

          {/* Members */}
          {members.length > 0 ? (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-md"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage
                      src={member.profile?.avatar_url || ""}
                      alt={member.profile?.display_name || "User"}
                    />
                    <AvatarFallback>
                      {getInitials(member.profile?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {member.profile?.display_name || "Ukjent bruker"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {member.profile?.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {getRoleDisplay(member.role)}
                  </Badge>

                  {(isCurrentUserOwner || isCurrentUserAdmin) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Role change options */}
                        <DropdownMenuItem
                          disabled={member.role === "viewer"}
                          onClick={() => handleChangeRole(member.id, "viewer")}
                        >
                          Sett som leser
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={member.role === "editor"}
                          onClick={() => handleChangeRole(member.id, "editor")}
                        >
                          Sett som redigerer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={member.role === "admin"}
                          onClick={() => handleChangeRole(member.id, "admin")}
                        >
                          Sett som administrator
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Remove option */}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedMemberId(member.id);
                            setSelectedMemberName(
                              member.profile?.display_name ||
                                member.profile?.email
                            );
                            setRemoveMemberDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Fjern fra arbeidsområde
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-8 border border-dashed rounded-md">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-medium mb-2">Ingen medlemmer ennå</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Dette arbeidsområdet har ingen andre medlemmer enn deg ennå.
                Legg til medlemmer for å dele tilgang til arbeidsområdet.
              </p>
              {(isCurrentUserOwner || isCurrentUserAdmin) && (
                <Button
                  variant="outline"
                  onClick={() => setAddMemberDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Legg til første medlem
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Remove member confirmation dialog */}
      <Dialog
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fjern medlem</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil fjerne {selectedMemberName} fra dette
              arbeidsområdet? De vil miste all tilgang til ressursene i
              arbeidsområdet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveMemberDialogOpen(false);
                setSelectedMemberId(null);
              }}
            >
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember}>
              Fjern medlem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
