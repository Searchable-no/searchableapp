"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getSharePointSites, type SharePointSite } from "@/lib/microsoft-graph";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { 
  FolderKanban, 
  Plus, 
  TrashIcon, 
  Loader2, 
  Cloud, 
  Grid3X3, 
  ArrowLeft 
} from "lucide-react";

// Zod schema for project form
const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().min(1, "Description is required"),
  workspace_id: z.string().min(1, "Workspace is required"),
  create_sharepoint: z.boolean().default(false),
  sharepoint_site_id: z.string().optional(),
  create_teams: z.boolean().default(false),
  team_id: z.string().optional(),
});

// Zod schema for column form
const columnSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  type: z.enum([
    "text", 
    "number", 
    "date", 
    "select", 
    "multiselect", 
    "user", 
    "team", 
    "boolean"
  ]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

const columnTypes = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single Select" },
  { value: "multiselect", label: "Multi Select" },
  { value: "user", label: "User" },
  { value: "team", label: "Team" },
  { value: "boolean", label: "Yes/No" },
];

interface Workspace {
  id: string;
  name: string;
}

export default function NewProjectPage() {
  const { session } = useSession();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sharePointSites, setSharePointSites] = useState<SharePointSite[]>([]);
  const [teams, setTeams] = useState<{id: string; displayName: string}[]>([]);
  const [columns, setColumns] = useState<z.infer<typeof columnSchema>[]>([
    { name: "Title", type: "text", required: true },
    { name: "Description", type: "text", required: false },
  ]);
  const [selectOptions, setSelectOptions] = useState<Record<number, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // Set up the form
  const form = useForm<z.infer<typeof projectFormSchema>>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      create_sharepoint: false,
      create_teams: false,
    },
  });

  // Fetch workspaces, SharePoint sites, and teams
  useEffect(() => {
    if (!session) return;
    
    const fetchWorkspaces = async () => {
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id, name")
          .order("name");
          
        if (error) throw error;
        setWorkspaces(data || []);
        
        // Set default workspace if available
        if (data && data.length > 0) {
          form.setValue("workspace_id", data[0].id);
        }
      } catch (error) {
        console.error("Error fetching workspaces:", error);
        toast({
          title: "Error",
          description: "Failed to load workspaces",
          variant: "destructive",
        });
      }
    };
    
    const fetchSharePointSites = async () => {
      if (!session.user?.id) return;
      
      setIsLoadingResources(true);
      try {
        // For demo purposes, we'll fetch the actual sites but have a fallback
        try {
          const sites = await getSharePointSites(session.user.id);
          setSharePointSites(sites);
        } catch (error) {
          console.error("Error fetching SharePoint sites:", error);
          // Demo data
          setSharePointSites([
            { id: "site1", name: "Marketing", displayName: "Marketing Site", webUrl: "#" },
            { id: "site2", name: "HR", displayName: "HR Portal", webUrl: "#" },
            { id: "site3", name: "Engineering", displayName: "Engineering Hub", webUrl: "#" },
          ]);
        }
        
        // Demo Teams data
        setTeams([
          { id: "team1", displayName: "Marketing Team" },
          { id: "team2", displayName: "HR Team" },
          { id: "team3", displayName: "Engineering Team" },
        ]);
      } catch (error) {
        console.error("Error fetching resources:", error);
      } finally {
        setIsLoadingResources(false);
      }
    };
    
    fetchWorkspaces();
    fetchSharePointSites();
  }, [session, supabase, form]);

  // Add new column
  const addColumn = () => {
    setColumns([...columns, { name: "", type: "text", required: false }]);
  };

  // Remove column
  const removeColumn = (index: number) => {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    setColumns(newColumns);
    
    // Remove options for this column if it had any
    const newOptions = { ...selectOptions };
    delete newOptions[index];
    setSelectOptions(newOptions);
  };

  // Handle column data changes
  const updateColumn = (index: number, field: keyof z.infer<typeof columnSchema>, value: any) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
    
    // If changing from a select type to something else, clear the options
    if (field === "type" && 
        value !== "select" && 
        value !== "multiselect" && 
        (newColumns[index].type === "select" || newColumns[index].type === "multiselect")) {
      const newOptions = { ...selectOptions };
      delete newOptions[index];
      setSelectOptions(newOptions);
    }
  };

  // Handle select options for a column
  const updateSelectOptions = (index: number, optionsString: string) => {
    const options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt);
    const newOptions = { ...selectOptions };
    newOptions[index] = options;
    setSelectOptions(newOptions);
  };

  // Check if a column should show options input
  const shouldShowOptions = (type: string) => {
    return type === "select" || type === "multiselect";
  };

  // Submit the form
  const onSubmit = async (data: z.infer<typeof projectFormSchema>) => {
    if (!session?.user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a project",
        variant: "destructive",
      });
      return;
    }
    
    // Validate columns
    const invalidColumn = columns.find(col => !col.name || !col.type);
    if (invalidColumn) {
      toast({
        title: "Invalid columns",
        description: "All columns must have a name and type",
        variant: "destructive",
      });
      return;
    }
    
    // Prepare columns with options
    const columnsWithOptions = columns.map((col, idx) => {
      if (shouldShowOptions(col.type) && selectOptions[idx]) {
        return { ...col, options: selectOptions[idx] };
      }
      return col;
    });
    
    setIsLoading(true);
    
    try {
      // Create project
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          columns: columnsWithOptions,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create project");
      }
      
      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      
      // Redirect to the project page
      router.push(`/projects/${result.project_id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Please sign in to create a project.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push("/projects")}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Project Details</TabsTrigger>
              <TabsTrigger value="columns">Form Columns</TabsTrigger>
              <TabsTrigger value="integration">Microsoft 365 Integration</TabsTrigger>
            </TabsList>
            
            {/* Project Details Tab */}
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Project Information</CardTitle>
                  <CardDescription>
                    Enter the basic information for your new project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter project description"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="workspace_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a workspace" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {workspaces.map((workspace) => (
                              <SelectItem key={workspace.id} value={workspace.id}>
                                {workspace.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The workspace this project belongs to
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => router.push("/projects")}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => form.trigger(["name", "description", "workspace_id"])}>
                    Continue to Form Columns
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Form Columns Tab */}
            <TabsContent value="columns">
              <Card>
                <CardHeader>
                  <CardTitle>Form Columns</CardTitle>
                  <CardDescription>
                    Define the columns for your project item form. These will be used as metadata for documents.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {columns.map((column, index) => (
                      <div key={index} className="p-4 border rounded-md">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-medium">Column {index + 1}</h3>
                          {(index > 1 || columns.length > 2) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeColumn(index)}
                              disabled={index < 2} // Don't allow removing the first two default columns
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium">Column Name</label>
                            <Input
                              value={column.name}
                              onChange={(e) => updateColumn(index, "name", e.target.value)}
                              placeholder="Enter column name"
                              className="mt-1"
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">Type</label>
                            <Select
                              value={column.type}
                              onValueChange={(value) => updateColumn(index, "type", value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select column type" />
                              </SelectTrigger>
                              <SelectContent>
                                {columnTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="flex items-center space-x-2 mt-6">
                              <Switch
                                checked={column.required}
                                onCheckedChange={(checked) => 
                                  updateColumn(index, "required", checked)
                                }
                                id={`required-${index}`}
                              />
                              <label
                                htmlFor={`required-${index}`}
                                className="text-sm font-medium"
                              >
                                Required
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        {shouldShowOptions(column.type) && (
                          <div className="mt-4">
                            <label className="text-sm font-medium">Options</label>
                            <Textarea
                              value={selectOptions[index]?.join(", ") || ""}
                              onChange={(e) => updateSelectOptions(index, e.target.value)}
                              placeholder="Enter options separated by commas"
                              className="mt-1"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Enter options separated by commas (e.g. "Option 1, Option 2, Option 3")
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={addColumn}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Column
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" type="button" onClick={() => form.trigger(["name", "description", "workspace_id"])}>
                    Back to Details
                  </Button>
                  <Button type="button">
                    Continue to Integration
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Integration Tab */}
            <TabsContent value="integration">
              <Card>
                <CardHeader>
                  <CardTitle>Microsoft 365 Integration</CardTitle>
                  <CardDescription>
                    Connect your project to SharePoint and Microsoft Teams.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingResources ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">SharePoint Site</h3>
                        <p className="text-sm text-muted-foreground">
                          Connect your project to a SharePoint site for document management. 
                          Documents added to this site will automatically inherit metadata from your project.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name="create_sharepoint"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Connect to SharePoint Site
                                  </FormLabel>
                                  <FormDescription>
                                    Enable SharePoint integration for this project
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("create_sharepoint") && (
                            <FormField
                              control={form.control}
                              name="sharepoint_site_id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SharePoint Site</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a SharePoint site" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {sharePointSites.map((site) => (
                                        <SelectItem key={site.id} value={site.id}>
                                          {site.displayName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Select an existing SharePoint site to connect
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Microsoft Teams</h3>
                        <p className="text-sm text-muted-foreground">
                          Connect your project to a Microsoft Teams team for collaboration.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name="create_teams"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Connect to Microsoft Teams
                                  </FormLabel>
                                  <FormDescription>
                                    Enable Microsoft Teams integration for this project
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("create_teams") && (
                            <FormField
                              control={form.control}
                              name="team_id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Microsoft Teams Team</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a Teams team" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {teams.map((team) => (
                                        <SelectItem key={team.id} value={team.id}>
                                          {team.displayName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Select an existing Teams team to connect
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" type="button">
                    Back to Form Columns
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Project
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
} 