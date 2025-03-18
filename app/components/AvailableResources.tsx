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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { File, MessageSquare, ListChecks, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase-browser";

interface ResourceOption {
  id: string;
  name: string;
  type: "sharepoint" | "teams" | "planner";
  url?: string;
}

interface AvailableResourcesProps {
  workspaces: { id: string; name: string }[];
  onResourceAdded?: () => void;
}

export function AvailableResources({
  workspaces,
  onResourceAdded,
}: AvailableResourcesProps) {
  const { session } = useSession();
  const [selectedTab, setSelectedTab] = useState<
    "sharepoint" | "teams" | "planner"
  >("sharepoint");
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<ResourceOption | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchResources(selectedTab);
    }
  }, [session?.user?.id, selectedTab]);

  const fetchResources = async (type: "sharepoint" | "teams" | "planner") => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

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

      setResources(data.data);
    } catch (error) {
      console.error(`Error fetching ${type} resources:`, error);
      setError(`Kunne ikke hente ${type}-ressurser`);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWorkspace = async () => {
    if (!selectedResource || !selectedWorkspaceId) {
      toast.error("Velg både ressurs og arbeidsområde");
      return;
    }

    setIsAdding(true);

    try {
      const newResource = {
        workspace_id: selectedWorkspaceId,
        resource_type: selectedResource.type,
        resource_id: selectedResource.id,
        resource_name: selectedResource.name,
        resource_url: selectedResource.url,
        bucket: "Ikke sortert", // Default bucket
      };

      const { error } = await supabase
        .from("workspace_resources")
        .insert(newResource);

      if (error) throw error;

      toast.success("Ressursen er lagt til i arbeidsområdet");
      setAddDialogOpen(false);
      setSelectedResource(null);
      setSelectedWorkspaceId("");

      if (onResourceAdded) {
        onResourceAdded();
      }
    } catch (error) {
      console.error("Error adding resource to workspace:", error);
      toast.error("Kunne ikke legge til ressursen i arbeidsområdet");
    } finally {
      setIsAdding(false);
    }
  };

  const filteredResources = searchTerm
    ? resources.filter((resource) =>
        resource.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : resources;

  const IconForType = {
    sharepoint: File,
    teams: MessageSquare,
    planner: ListChecks,
  };

  const TypeName = {
    sharepoint: "SharePoint-side",
    teams: "Teams-kanal",
    planner: "Planner-plan",
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Tilgjengelige ressurser</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          defaultValue="sharepoint"
          value={selectedTab}
          onValueChange={(value) =>
            setSelectedTab(value as "sharepoint" | "teams" | "planner")
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sharepoint" className="flex items-center gap-2">
              <File className="h-4 w-4" />
              <span>SharePoint</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Teams</span>
            </TabsTrigger>
            <TabsTrigger value="planner" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              <span>Planner</span>
            </TabsTrigger>
          </TabsList>

          {["sharepoint", "teams", "planner"].map((type) => (
            <TabsContent key={type} value={type} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Søk etter ${
                    TypeName[type as keyof typeof TypeName]
                  }...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="py-6 text-center text-muted-foreground">
                  <p>{error}</p>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <p>Ingen ressurser funnet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {filteredResources.map((resource) => {
                    const Icon = IconForType[resource.type];
                    return (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:border-primary/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{resource.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {TypeName[resource.type]}
                            </div>
                          </div>
                        </div>
                        <Dialog
                          open={
                            addDialogOpen &&
                            selectedResource?.id === resource.id
                          }
                          onOpenChange={(open) => {
                            if (!open) {
                              setSelectedResource(null);
                            }
                            setAddDialogOpen(open);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setSelectedResource(resource)}
                            >
                              <Plus className="h-4 w-4" />
                              <span className="sr-only">Legg til</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Legg til i arbeidsområde
                              </DialogTitle>
                              <DialogDescription>
                                Velg hvilket arbeidsområde du vil legge til
                                &quot;{resource?.name}&quot; i
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <Label htmlFor="workspace">Arbeidsområde</Label>
                              <Select
                                value={selectedWorkspaceId}
                                onValueChange={setSelectedWorkspaceId}
                              >
                                <SelectTrigger id="workspace">
                                  <SelectValue placeholder="Velg arbeidsområde" />
                                </SelectTrigger>
                                <SelectContent>
                                  {workspaces.map((workspace) => (
                                    <SelectItem
                                      key={workspace.id}
                                      value={workspace.id}
                                    >
                                      {workspace.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setAddDialogOpen(false)}
                              >
                                Avbryt
                              </Button>
                              <Button
                                onClick={addToWorkspace}
                                disabled={!selectedWorkspaceId || isAdding}
                              >
                                {isAdding ? "Legger til..." : "Legg til"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
