"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ChevronLeft, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { ResourceDragItem } from "./resource-drag-item";
import { ResourceBucket } from "./resource-bucket";

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
  bucket?: string;
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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // For bucket management
  const [buckets, setBuckets] = useState<string[]>([
    "Ikke sortert",
    "Viktig",
    "Relevant",
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [addBucketDialogOpen, setAddBucketDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const workspaceId = params.id as string;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        .eq("user_id", session?.user?.id)
        .single();

      if (workspaceError) throw workspaceError;
      if (!workspaceData) {
        toast.error("Arbeidsområdet ble ikke funnet");
        router.push("/workspaces");
        return;
      }

      setWorkspace(workspaceData);

      // Fetch workspace resources
      const { data: resourcesData, error: resourcesError } = await supabase
        .from("workspace_resources")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (resourcesError) throw resourcesError;
      setResources(resourcesData || []);

      // Fetch buckets (in a real app, this would come from the database)
      // For demo purposes, we're using hardcoded buckets with the addition of any
      // unique buckets from existing resources
      if (resourcesData) {
        const existingBuckets = resourcesData
          .map((r) => r.bucket)
          .filter((b) => b && !buckets.includes(b)) as string[];

        if (existingBuckets.length > 0) {
          setBuckets([...buckets, ...existingBuckets]);
        }
      }
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
        bucket: "Ikke sortert", // Default bucket
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
      console.error("Error adding resource:", error);
      toast.error("Kunne ikke legge til ressurs");
    } finally {
      setIsAddingResource(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (over && active.id !== over.id) {
      // If we're dragging to a bucket
      if (typeof over.id === "string" && over.id.startsWith("bucket-")) {
        const bucketName = over.id.replace("bucket-", "");
        const resourceId = active.id.toString();

        // Update the resource's bucket
        const updatedResources = resources.map((resource) =>
          resource.id === resourceId
            ? { ...resource, bucket: bucketName }
            : resource
        );

        setResources(updatedResources);

        // Save to database
        try {
          const resource = updatedResources.find((r) => r.id === resourceId);
          if (resource) {
            const { error } = await supabase
              .from("workspace_resources")
              .update({ bucket: bucketName })
              .eq("id", resourceId);

            if (error) throw error;
          }
        } catch (error) {
          console.error("Error updating resource bucket:", error);
          toast.error("Kunne ikke oppdatere ressursgruppe");
        }
      }
    }
  };

  const addNewBucket = () => {
    if (!newBucketName.trim()) return;

    if (buckets.includes(newBucketName.trim())) {
      toast.error("En gruppe med dette navnet eksisterer allerede");
      return;
    }

    setBuckets([...buckets, newBucketName.trim()]);
    setNewBucketName("");
    setAddBucketDialogOpen(false);
    toast.success("Ny gruppe lagt til");
  };

  const deleteWorkspace = async () => {
    setIsSaving(true);
    try {
      // First delete all associated resources
      const { error: resourcesError } = await supabase
        .from("workspace_resources")
        .delete()
        .eq("workspace_id", workspaceId);

      if (resourcesError) throw resourcesError;

      // Then delete the workspace
      const { error: workspaceError } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);

      if (workspaceError) throw workspaceError;

      toast.success("Arbeidsområdet er slettet");
      router.push("/workspaces");
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast.error("Kunne ikke slette arbeidsområdet");
    } finally {
      setIsSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  // Filter resources based on search term
  const filteredResources = searchTerm
    ? resources.filter((resource) =>
        resource.resource_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : resources;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Button variant="outline" size="icon" asChild>
          <Link href="/workspaces">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">
          {workspace?.name || "Arbeidsområde"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Ressurser</CardTitle>
            <CardDescription>
              Totalt antall ressurser i dette arbeidsområdet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{resources.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Grupper</CardTitle>
            <CardDescription>
              Antall ressursgrupper i arbeidsområdet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{buckets.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Søkefilter</CardTitle>
            <CardDescription>Bruk som filter i appens søk</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button asChild className="w-full">
              <Link href={`/search/normal?workspace=${workspaceId}`}>
                <Search className="h-4 w-4 mr-2" />
                Søk med dette arbeidsområdet
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Ressursgrupper</h2>
        <div className="flex items-center gap-2">
          <Dialog
            open={addBucketDialogOpen}
            onOpenChange={setAddBucketDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Legg til gruppe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ny ressursgruppe</DialogTitle>
                <DialogDescription>
                  Opprett en ny gruppe for å organisere ressursene dine.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="bucketName">Gruppenavn</Label>
                  <Input
                    id="bucketName"
                    placeholder="Skriv navn på gruppen"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddBucketDialogOpen(false)}
                >
                  Avbryt
                </Button>
                <Button onClick={addNewBucket} disabled={!newBucketName.trim()}>
                  Legg til
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={addResourceDialogOpen}
            onOpenChange={setAddResourceDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Legg til ressurs
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Legg til ressurs</DialogTitle>
                <DialogDescription>
                  Velg en Microsoft 365-ressurs å legge til i dette
                  arbeidsområdet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="resourceType">Ressurstype</Label>
                  <Select
                    value={selectedResourceType}
                    onValueChange={(
                      value: "sharepoint" | "teams" | "planner"
                    ) => handleResourceTypeChange(value)}
                  >
                    <SelectTrigger id="resourceType">
                      <SelectValue placeholder="Velg ressurstype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharepoint">
                        SharePoint-side
                      </SelectItem>
                      <SelectItem value="teams">Teams-kanal</SelectItem>
                      <SelectItem value="planner">Planner-plan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedResourceType && (
                  <div className="space-y-2">
                    <Label htmlFor="resource">Velg ressurs</Label>
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
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk etter ressurser..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {buckets.map((bucket) => {
            const bucketResources = filteredResources.filter(
              (resource) => resource.bucket === bucket
            );
            return (
              <ResourceBucket
                key={bucket}
                id={`bucket-${bucket}`}
                title={bucket}
                resources={bucketResources}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-80">
              {resources.find((r) => r.id === activeId) && (
                <ResourceDragItem
                  resource={resources.find((r) => r.id === activeId)!}
                  isDragging
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-8 border-t pt-6">
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Slett arbeidsområde
        </Button>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slett arbeidsområde</DialogTitle>
              <DialogDescription>
                Er du sikker på at du vil slette dette arbeidsområdet? Denne
                handlingen kan ikke angres.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                onClick={deleteWorkspace}
                disabled={isSaving}
              >
                {isSaving ? "Sletter..." : "Slett"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
