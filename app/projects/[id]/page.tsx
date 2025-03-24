"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  FolderKanban, 
  Users, 
  Plus, 
  Pencil, 
  File, 
  FileText,
  Settings,
  Loader2
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string;
  sharepoint_site_id?: string;
  team_id?: string;
  created_at: string;
  updated_at: string;
}

interface ProjectColumn {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  order: number;
}

interface ProjectItem {
  id: string;
  values: Record<string, any>;
  created_by: string;
  created_at: string;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { session } = useSession();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [project, setProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');

  useEffect(() => {
    if (!session || !session.user || !params.id) return;

    async function fetchProjectData() {
      try {
        setIsLoading(true);
        const userId = session.user.id;
        
        // Fetch project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch user role
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', params.id)
          .eq('user_id', userId)
          .single();

        if (memberError) {
          console.error("Error fetching user role:", memberError);
        } else {
          setUserRole(memberData.role);
        }
        
        // Fetch columns
        const { data: columnsData, error: columnsError } = await supabase
          .from('project_columns')
          .select('*')
          .eq('project_id', params.id)
          .order('order');

        if (columnsError) throw columnsError;
        setColumns(columnsData || []);
        
        // Fetch items
        const { data: itemsData, error: itemsError } = await supabase
          .from('project_items')
          .select('*')
          .eq('project_id', params.id);

        if (itemsError) throw itemsError;
        setItems(itemsData || []);
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjectData();
  }, [session, params.id, supabase]);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Please sign in to view this project.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Project not found or you don&apos;t have access to it.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push("/projects")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {canEdit && (
            <Button onClick={() => router.push(`/projects/${params.id}/new-item`)}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          )}
          {userRole === 'owner' && (
            <Button variant="outline" onClick={() => router.push(`/projects/${params.id}/settings`)}>
              <Settings className="h-4 w-4 mr-2" /> Settings
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {project.team_id && <TabsTrigger value="team">Team</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Project Items</CardTitle>
              <CardDescription>
                Manage items in this project. Each item can have associated documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No items yet</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Add your first project item to start tracking work and organizing documents.
                  </p>
                  {canEdit && (
                    <Button onClick={() => router.push(`/projects/${params.id}/new-item`)}>
                      <Plus className="h-4 w-4 mr-2" /> Add First Item
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column.id}>{column.name}</TableHead>
                      ))}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        {columns.map((column) => (
                          <TableCell key={column.id}>
                            {renderItemValue(item.values[column.id], column.type)}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => router.push(`/projects/${params.id}/items/${item.id}`)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => router.push(`/projects/${params.id}/items/${item.id}/edit`)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Browse documents associated with this project.
                {project.sharepoint_site_id && " Documents are stored in SharePoint and inherit project metadata."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <File className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Project Documents</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  {project.sharepoint_site_id 
                    ? "Documents are synchronized with SharePoint. Upload files to access them here."
                    : "Connect a SharePoint site to enable document management with metadata."}
                </p>
                {project.sharepoint_site_id ? (
                  <Button onClick={() => window.open(`https://sharepoint.example.com/${project.sharepoint_site_id}`, '_blank')}>
                    Open in SharePoint
                  </Button>
                ) : userRole === 'owner' && (
                  <Button variant="outline" onClick={() => router.push(`/projects/${params.id}/settings`)}>
                    Connect SharePoint
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {project.team_id && (
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
                <CardDescription>
                  Team members who have access to this project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Project Team</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    This project is connected to a Microsoft Teams team. Collaborate with team members there.
                  </p>
                  <Button onClick={() => window.open(`https://teams.microsoft.com/l/team/${project.team_id}`, '_blank')}>
                    Open in Microsoft Teams
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function renderItemValue(value: any, type: string) {
  if (value === undefined || value === null) {
    return "-";
  }

  switch (type) {
    case "date":
      return new Date(value).toLocaleDateString();
    case "boolean":
      return value ? "Yes" : "No";
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : value;
    default:
      return value.toString();
  }
} 