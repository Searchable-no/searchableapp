"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Folder, Edit2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  resources: WorkspaceResource[];
}

interface WorkspaceResource {
  id: string;
  workspace_id: string;
  resource_type: "sharepoint" | "teams" | "planner";
  resource_id: string;
  resource_name: string;
  resource_url?: string;
}

export default function WorkspacesPage() {
  const { session, loading: sessionLoading } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!sessionLoading && session?.user) {
      fetchWorkspaces();
    }
  }, [sessionLoading, session]);

  async function fetchWorkspaces() {
    setIsLoading(true);
    try {
      // Fetch workspaces from Supabase
      const { data: workspacesData, error: workspacesError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("created_at", { ascending: false });

      if (workspacesError) throw workspacesError;

      if (workspacesData) {
        // For each workspace, fetch its resources
        const workspacesWithResources = await Promise.all(
          workspacesData.map(async (workspace) => {
            const { data: resourcesData, error: resourcesError } =
              await supabase
                .from("workspace_resources")
                .select("*")
                .eq("workspace_id", workspace.id);

            if (resourcesError) throw resourcesError;

            return {
              ...workspace,
              resources: resourcesData || [],
            };
          })
        );

        setWorkspaces(workspacesWithResources);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      toast.error("Kunne ikke hente arbeidsområder");
    } finally {
      setIsLoading(false);
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({
          name: newWorkspaceName.trim(),
          user_id: session?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newWorkspace = { ...data, resources: [] };
        setWorkspaces([newWorkspace, ...workspaces]);
        setNewWorkspaceName("");
        setCreateDialogOpen(false);
        toast.success("Arbeidsområde opprettet");
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast.error("Kunne ikke opprette arbeidsområde");
    } finally {
      setIsCreating(false);
    }
  }

  const filteredWorkspaces = searchTerm
    ? workspaces.filter((workspace) =>
        workspace.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : workspaces;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Arbeidsområder</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Nytt arbeidsområde</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opprett nytt arbeidsområde</DialogTitle>
              <DialogDescription>
                Lag et nytt arbeidsområde for å organisere dine Microsoft
                365-ressurser.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn</Label>
                <Input
                  id="name"
                  placeholder="Skriv navnet på arbeidsområdet"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNewWorkspaceName("");
                  setCreateDialogOpen(false);
                }}
              >
                Avbryt
              </Button>
              <Button
                onClick={createWorkspace}
                disabled={!newWorkspaceName.trim() || isCreating}
              >
                {isCreating ? "Oppretter..." : "Opprett"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk etter arbeidsområder..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded mb-2 w-1/2"></div>
                <div className="h-4 bg-muted rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkspaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="overflow-hidden transition-all hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl">{workspace.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/workspaces/${workspace.id}`}>
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Rediger</span>
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  {workspace.resources.length === 0
                    ? "Ingen ressurser lagt til ennå"
                    : `${workspace.resources.length} ressurser`}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {workspace.resources.slice(0, 3).map((resource) => (
                    <div
                      key={resource.id}
                      className="px-3 py-1 bg-muted rounded-full text-xs flex items-center"
                    >
                      <Folder className="h-3 w-3 mr-1" />
                      <span className="truncate max-w-[150px]">
                        {resource.resource_name}
                      </span>
                    </div>
                  ))}
                  {workspace.resources.length > 3 && (
                    <div className="px-3 py-1 bg-muted rounded-full text-xs">
                      +{workspace.resources.length - 3} mer
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/workspaces/${workspace.id}`}>
                      Administrer ressurser
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="rounded-full bg-muted p-6 mb-6">
            <Folder className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Ingen arbeidsområder funnet
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchTerm
              ? "Ingen arbeidsområder samsvarer med søket ditt. Prøv et annet søk."
              : "Du har ikke opprettet noen arbeidsområder ennå. Kom i gang ved å opprette ditt første arbeidsområde."}
          </p>
          {!searchTerm && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Opprett arbeidsområde
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
