"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronLeft,
  Plus,
  Trash2,
  Search,
  File,
  MessageSquare,
  ListChecks,
  X,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceMembers } from "@/app/components/WorkspaceMembers";

interface Workspace {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface WorkspaceResource {
  id: string;
  workspace_id: string;
  resource_type: "sharepoint" | "teams" | "planner";
  resource_id: string;
  resource_name: string;
  resource_url?: string;
}

interface ResourceOption {
  id: string;
  name: string;
  type: "sharepoint" | "teams" | "planner";
  url?: string;
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [resources, setResources] = useState<WorkspaceResource[]>([]);
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState<
    "sharepoint" | "teams" | "planner" | ""
  >("");
  const [availableResources, setAvailableResources] = useState<
    ResourceOption[]
  >([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedResourceToDelete, setSelectedResourceToDelete] = useState<
    string | null
  >(null);
  const [deleteResourceDialogOpen, setDeleteResourceDialogOpen] =
    useState(false);
  const [activeTab, setActiveTab] = useState<string>("resources");
  const [isSharedWorkspace, setIsSharedWorkspace] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const workspaceId = params.id as string;

  useEffect(() => {
    if (!sessionLoading && session?.user) {
      fetchWorkspaceDetails();
    }
  }, [sessionLoading, session, workspaceId]);

  const fetchWorkspaceDetails = async () => {
    try {
      // Fetch workspace details
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (workspaceError) throw workspaceError;
      if (!workspaceData) {
        toast.error("Arbeidsområdet ble ikke funnet");
        router.push("/workspaces");
        return;
      }

      setWorkspace(workspaceData);

      // Check if this is a shared workspace
      if (workspaceData.user_id !== session?.user?.id) {
        setIsSharedWorkspace(true);
        // Without profile data, use a simplified owner name
        setOwnerName("User " + workspaceData.user_id.substring(0, 8));
      }

      // Fetch workspace resources
      const { data: resourcesData, error: resourcesError } = await supabase
        .from("workspace_resources")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (resourcesError) throw resourcesError;
      setResources(resourcesData || []);
    } catch (error) {
      console.error("Error fetching workspace details:", error);
      toast.error("Kunne ikke hente arbeidsområdedetaljer");
    }
  };

  const fetchAvailableResources = async (
    type: "sharepoint" | "teams" | "planner"
  ) => {
    try {
      let endpoint = "";
      switch (type) {
        case "sharepoint":
          endpoint = "/api/microsoft/resources/sharepoint";
          break;
        case "teams":
          endpoint = "/api/microsoft/resources/teams";
          break;
        case "planner":
          endpoint = "/api/microsoft/resources/planner";
          break;
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} resources`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || `Failed to fetch ${type} resources`);
      }

      // Filter out resources that are already added
      const existingResourceIds = resources
        .filter((r) => r.resource_type === type)
        .map((r) => r.resource_id);

      const filteredResources = data.data.filter(
        (r: ResourceOption) => !existingResourceIds.includes(r.id)
      );

      setAvailableResources(filteredResources);
    } catch (error) {
      console.error(`Error fetching ${selectedResourceType} resources:`, error);
      toast.error(`Kunne ikke hente ${selectedResourceType}-ressurser`);
      setAvailableResources([]);
    }
  };

  const handleResourceTypeChange = (
    value: "sharepoint" | "teams" | "planner"
  ) => {
    setSelectedResourceType(value);
    setSelectedResourceId("");
    fetchAvailableResources(value);
  };

  const addResourceToWorkspace = async () => {
    if (!selectedResourceType || !selectedResourceId) return;

    setIsAddingResource(true);
    try {
      const selectedResource = availableResources.find(
        (r) => r.id === selectedResourceId
      );
      if (!selectedResource) return;

      const newResource = {
        workspace_id: workspaceId,
        resource_type: selectedResourceType,
        resource_id: selectedResourceId,
        resource_name: selectedResource.name,
        resource_url: selectedResource.url,
      };

      const { data, error } = await supabase
        .from("workspace_resources")
        .insert(newResource)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setResources([...resources, data]);
        setAddResourceDialogOpen(false);
        setSelectedResourceType("");
        setSelectedResourceId("");
        toast.success("Ressurs lagt til i arbeidsområdet");
      }
    } catch (error) {
      console.error("Error adding resource to workspace:", error);
      toast.error("Kunne ikke legge til ressurs i arbeidsområdet");
    } finally {
      setIsAddingResource(false);
    }
  };

  const deleteWorkspace = async () => {
    try {
      // Delete all resources associated with this workspace
      const { error: resourcesError } = await supabase
        .from("workspace_resources")
        .delete()
        .eq("workspace_id", workspaceId);

      if (resourcesError) throw resourcesError;

      // Delete the workspace
      const { error: workspaceError } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);

      if (workspaceError) throw workspaceError;

      toast.success("Arbeidsområde slettet");
      router.push("/workspaces");
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast.error("Kunne ikke slette arbeidsområdet");
    }
  };

  const deleteResource = async () => {
    if (!selectedResourceToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("workspace_resources")
        .delete()
        .eq("id", selectedResourceToDelete);

      if (error) throw error;

      setResources(resources.filter((r) => r.id !== selectedResourceToDelete));
      toast.success("Ressurs fjernet fra arbeidsområdet");
      setDeleteResourceDialogOpen(false);
      setSelectedResourceToDelete(null);
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast.error("Kunne ikke fjerne ressursen");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter resources based on search term
  const filteredResources = searchTerm
    ? resources.filter((resource) =>
        resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : resources;

  // Get resource icon based on type
  const getResourceIcon = (type: string) => {
    switch (type) {
      case "sharepoint":
        return <File className="h-4 w-4" />;
      case "teams":
        return <MessageSquare className="h-4 w-4" />;
      case "planner":
        return <ListChecks className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link
          href="/workspaces"
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span>Tilbake til arbeidsområder</span>
        </Link>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            {workspace?.name || "Laster..."}
          </h1>
          {workspace && workspace.user_id === session?.user?.id && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="px-3 gap-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>Slett arbeidsområde</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {isSharedWorkspace && (
        <div className="mb-6 p-4 border border-primary/20 bg-primary/5 rounded-lg flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm">
              Dette arbeidsområdet er delt med deg av{" "}
              <span className="font-medium">{ownerName}</span>.
            </p>
          </div>
        </div>
      )}

      <Tabs
        defaultValue="resources"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="resources" className="gap-2">
            <File className="h-4 w-4" />
            <span>Ressurser</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            <span>Medlemmer</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter ressurser..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Dialog
              open={addResourceDialogOpen}
              onOpenChange={setAddResourceDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Legg til ressurs</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Legg til ressurs</DialogTitle>
                  <DialogDescription>
                    Velg en ressurs å legge til i dette arbeidsområdet.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="resource-type">Ressurstype</Label>
                    <Select
                      value={selectedResourceType}
                      onValueChange={(
                        value: "sharepoint" | "teams" | "planner"
                      ) => handleResourceTypeChange(value)}
                    >
                      <SelectTrigger id="resource-type">
                        <SelectValue placeholder="Velg ressurstype" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sharepoint">
                          SharePoint-sider
                        </SelectItem>
                        <SelectItem value="teams">Teams-kanaler</SelectItem>
                        <SelectItem value="planner">Planner-planer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedResourceType && (
                    <div className="space-y-2">
                      <Label htmlFor="resource">
                        {selectedResourceType === "sharepoint"
                          ? "SharePoint-side"
                          : selectedResourceType === "teams"
                          ? "Teams-kanal"
                          : "Planner-plan"}
                      </Label>
                      <Select
                        value={selectedResourceId}
                        onValueChange={setSelectedResourceId}
                        disabled={availableResources.length === 0}
                      >
                        <SelectTrigger id="resource">
                          <SelectValue
                            placeholder={
                              availableResources.length === 0
                                ? "Ingen tilgjengelige ressurser"
                                : "Velg ressurs"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableResources.map((resource) => (
                            <SelectItem key={resource.id} value={resource.id}>
                              {resource.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedResourceType("");
                      setSelectedResourceId("");
                      setAddResourceDialogOpen(false);
                    }}
                  >
                    Avbryt
                  </Button>
                  <Button
                    onClick={addResourceToWorkspace}
                    disabled={
                      !selectedResourceType ||
                      !selectedResourceId ||
                      isAddingResource
                    }
                  >
                    {isAddingResource ? "Legger til..." : "Legg til"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {filteredResources.length === 0 ? (
            <Card className="shadow-sm border-dashed border-2 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm
                    ? "Ingen ressurser matcher søket ditt"
                    : "Ingen ressurser lagt til ennå"}
                </h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  {searchTerm
                    ? "Prøv å søke etter noe annet, eller fjern søket for å se alle ressurser"
                    : "Legg til SharePoint-sider, Teams-kanaler eller Planner-planer i dette arbeidsområdet for å gjøre dem søkbare sammen."}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setAddResourceDialogOpen(true)}
                    variant="default"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Legg til første ressurs
                  </Button>
                )}
                {searchTerm && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm("")}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Fjern søk
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredResources.map((resource) => (
                <Card
                  key={resource.id}
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-md text-primary">
                        {getResourceIcon(resource.resource_type)}
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {resource.resource_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {resource.resource_type === "sharepoint" &&
                            "SharePoint-side"}
                          {resource.resource_type === "teams" && "Teams-kanal"}
                          {resource.resource_type === "planner" &&
                            "Planner-plan"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setSelectedResourceToDelete(resource.id);
                        setDeleteResourceDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <WorkspaceMembers workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett arbeidsområde</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette dette arbeidsområdet? Dette vil
              fjerne alle ressurser fra arbeidsområdet, men ikke selve
              ressursene.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Avbryt
            </Button>
            <Button variant="destructive" onClick={deleteWorkspace}>
              Slett arbeidsområde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteResourceDialogOpen}
        onOpenChange={setDeleteResourceDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fjern ressurs</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil fjerne denne ressursen fra
              arbeidsområdet? Dette vil bare fjerne ressursen fra
              arbeidsområdet, ikke selve ressursen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteResourceDialogOpen(false);
                setSelectedResourceToDelete(null);
              }}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={deleteResource}
              disabled={isDeleting}
            >
              {isDeleting ? "Fjerner..." : "Fjern ressurs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
