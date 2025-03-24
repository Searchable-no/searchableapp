"use client";

import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { 
  Search,
  FileText,
  Settings,
  Layout,
  BarChart3,
  Mail,
  MessageSquare,
  ListTodo,
  Filter
} from "lucide-react";

export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-[1920px]">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how to use the Searchable application to find and manage your content
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Search Functionality</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="search-basics">
              <AccordionTrigger>Basic Search</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  Type your search query in the search bar at the top of the search page and press Enter or click the search button.
                </p>
                <p className="mb-2">
                  The application will search across your connected workspaces including emails, documents, chats, and tasks.
                </p>
                <p>
                  Results will display in a table format showing file name, type, size, creator, and other relevant information.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="search-filters">
              <AccordionTrigger>Using Filters</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p>
                    Refine your search results using the available filters:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <span className="font-medium">File Types</span>: Filter by document types (Word, Excel, PDF, etc.) or content types (Emails, Teams Chats, Tasks)
                    </li>
                    <li>
                      <span className="font-medium">Time Range</span>: Filter by when files were last modified (24 hours, 7 days, 30 days, etc.)
                    </li>
                    <li>
                      <span className="font-medium">Creators</span>: Filter results by the person who created the content
                    </li>
                    <li>
                      <span className="font-medium">Sites/Workspaces</span>: Filter by specific SharePoint sites or workspaces
                    </li>
                  </ul>
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click the filter button to show or hide available filters</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="search-results">
              <AccordionTrigger>Working with Search Results</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  Click on any result to preview the content in a dialog window. From there, you can:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>View file details and metadata</li>
                  <li>Open the file in its native application using the "Open in Browser" button</li>
                  <li>Preview the content directly within the application (for supported file types)</li>
                </ul>
                <p className="mt-2">
                  Use the pagination controls at the bottom of the results to navigate through multiple pages of results.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Workspaces</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="workspaces-overview">
              <AccordionTrigger>Understanding Workspaces</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  Workspaces are collections of content from Microsoft 365 sources (SharePoint, OneDrive, Outlook, Teams, Planner).
                </p>
                <p>
                  Each workspace can be configured to include specific sites, libraries, or content types for more organized searching.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="managing-workspaces">
              <AccordionTrigger>Managing Workspaces</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  To manage your workspaces:
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Navigate to the Workspaces section from the sidebar</li>
                  <li>Create a new workspace by clicking the "New Workspace" button</li>
                  <li>Configure which sites and content types to include</li>
                  <li>Set permissions for who can access each workspace</li>
                </ol>
                <p className="mt-2">
                  You can edit or delete existing workspaces from the Workspaces dashboard.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Dashboard</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="dashboard-overview">
              <AccordionTrigger>Dashboard Overview</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  The dashboard provides an overview of your connected content and recent activity:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Recent searches and frequently accessed files</li>
                  <li>Summary of content across your workspaces</li>
                  <li>Quick access to important documents</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="dashboard-customize">
              <AccordionTrigger>Customizing Your Dashboard</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  You can customize your dashboard to show the information most relevant to you:
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Click the customize button in the top-right corner of the dashboard</li>
                  <li>Add, remove, or rearrange dashboard widgets</li>
                  <li>Set default filters and views for quick access</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Settings & Account</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="account-settings">
              <AccordionTrigger>Account Settings</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  Manage your account settings:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Update your profile information</li>
                  <li>Change your password</li>
                  <li>Configure notification preferences</li>
                  <li>Manage connected accounts and integrations</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="app-settings">
              <AccordionTrigger>Application Settings</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  Configure application-wide settings:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Toggle between light and dark mode (also available in the sidebar)</li>
                  <li>Set default search behavior and filters</li>
                  <li>Configure data retention policies</li>
                  <li>Manage API connections and integrations</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Content Types</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <h3 className="font-medium">Documents</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Search across Word, Excel, PowerPoint, PDF, and other document types stored in SharePoint and OneDrive.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-sky-500" />
              <h3 className="font-medium">Emails</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Find emails from your Outlook inbox and folders based on content, sender, recipient, or attachments.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-500" />
              <h3 className="font-medium">Teams Chats</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Search through your Microsoft Teams chats and channel conversations for specific messages or shared files.
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-purple-500" />
              <h3 className="font-medium">Tasks</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Find tasks from Microsoft Planner, including details about assignments, due dates, and progress.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-center mt-8">
        <div className="space-y-2 max-w-md text-center">
          <h3 className="font-medium">Need Additional Help?</h3>
          <p className="text-sm text-muted-foreground">
            If you need further assistance or have questions not addressed in this documentation, please contact your system administrator.
          </p>
          <Button className="mt-2">
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
} 