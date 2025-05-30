import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Upload, File, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { processEmailContent } from "@/lib/email-processor";

// Define types for Microsoft 365 resources
export type Microsoft365Resource = {
  id: string;
  name: string;
  type: "email" | "file" | "files";
  icon?: React.ReactNode;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  url?: string; // SharePoint url field
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  receivedDateTime?: string;
  subject?: string;
  content?: string; // Document content extracted by Document Intelligence
  preview?: string; // Preview of content for display in the UI
};

interface SearchResultItem {
  id: string;
  name: string;
  subject?: string;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
    // Alternative format properties
    name?: string;
    email?: string;
  };
  receivedDateTime?: string;
  bodyPreview?: string;
}

interface ResourcePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectResources: (resources: Microsoft365Resource[]) => void;
  userId: string;
}

export default function ResourcePicker({
  open,
  onOpenChange,
  onSelectResources,
  userId,
}: ResourcePickerProps) {
  const [activeTab, setActiveTab] = useState<"email" | "file">("email");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Microsoft365Resource[]>(
    []
  );
  const [selectedResources, setSelectedResources] = useState<
    Microsoft365Resource[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedResources([]);
    }
  }, [open]);

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // Use the existing search functionality
        const endpoint =
          activeTab === "email"
            ? `/api/search/emails?query=${encodeURIComponent(searchQuery)}`
            : `/api/search/files?query=${encodeURIComponent(searchQuery)}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();

        // Transform results to Microsoft365Resource format
        const formattedResults = data.results.map((item: SearchResultItem) => {
          let preview = "";

          // Prepare preview text
          if (activeTab === "email" && item.bodyPreview) {
            preview =
              item.bodyPreview.substring(0, 180) +
              (item.bodyPreview.length > 180 ? "..." : "");
          }

          // Normalize the from field to handle different API response formats
          let normalizedFrom = undefined;
          if (item.from) {
            if (item.from.emailAddress) {
              // Standard Graph API format
              normalizedFrom = {
                emailAddress: {
                  name: item.from.emailAddress.name,
                  address: item.from.emailAddress.address,
                },
              };
            } else if (item.from.name || item.from.email) {
              // Alternative format from search API
              normalizedFrom = {
                emailAddress: {
                  name: item.from.name,
                  address: item.from.email,
                },
              };
            }
          }

          // Create the formatted resource
          return {
            id: item.id,
            name: activeTab === "email" ? item.subject || item.name : item.name,
            type: activeTab === "email" ? "email" : "file",
            icon:
              activeTab === "email" ? (
                <Mail className="h-4 w-4" />
              ) : (
                <File className="h-4 w-4" />
              ),
            size: item.size,
            lastModifiedDateTime: item.lastModifiedDateTime,
            webUrl: item.webUrl,
            from: normalizedFrom,
            receivedDateTime: item.receivedDateTime,
            subject: item.subject || item.name,
            // Include preview from bodyPreview if available
            preview: preview || undefined,
          };
        });

        setSearchResults(formattedResults);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab, userId]);

  // Process document content using Azure Document Intelligence
  const processDocumentContent = async (resource: Microsoft365Resource) => {
    if (resource.type !== "file" && resource.type !== "files") {
      return resource;
    }

    // Get the file URL - use webUrl or url property, whichever is available
    const fileUrl = resource.webUrl || resource.url;
    if (!fileUrl) {
      console.error("File URL not available for", resource.name);
      return resource;
    }

    try {
      console.log(`Processing document: ${resource.name} with URL: ${fileUrl}`);

      // Call the document analysis API
      const response = await fetch("/api/documents/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl,
          fileName: resource.name,
          fileType: getFileContentType(resource.name),
          fileSize: resource.size,
          lastModified: resource.lastModifiedDateTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze document");
      }

      const data = await response.json();
      console.log(
        `Document processed successfully: ${resource.name}, content length: ${data.documentContent.content.length} characters`
      );

      // Return resource with extracted content
      return {
        ...resource,
        content: data.documentContent.content,
      };
    } catch (error: any) {
      console.error("Error processing document:", error);
      toast({
        title: "Behandling feilet",
        description: `Kunne ikke hente innhold fra "${resource.name}": ${error.message}`,
        variant: "destructive",
        duration: 5000,
      });
      return resource;
    }
  };

  // Helper to determine file MIME type from filename
  const getFileContentType = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return "application/pdf";
      case "doc":
        return "application/msword";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "xls":
        return "application/vnd.ms-excel";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "ppt":
        return "application/vnd.ms-powerpoint";
      case "pptx":
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case "txt":
        return "text/plain";
      case "csv":
        return "text/csv";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      default:
        return "application/octet-stream";
    }
  };

  // Handle selecting a resource
  const toggleResourceSelection = (resource: Microsoft365Resource) => {
    console.log("Toggling resource selection:", resource);

    setSelectedResources((prev) => {
      const isSelected = prev.some((r) => r.id === resource.id);

      if (isSelected) {
        // Remove resource
        const newResources = prev.filter((r) => r.id !== resource.id);
        console.log("Resource removed, new count:", newResources.length);
        return newResources;
      } else {
        // Add resource
        const newResources = [...prev, resource];
        console.log("Resource added, new count:", newResources.length);
        return newResources;
      }
    });
  };

  // Handle removing a selected resource
  const removeSelectedResource = (resourceId: string) => {
    setSelectedResources((prev) => prev.filter((r) => r.id !== resourceId));
  };

  // Save selected resources - NOW WITH DOCUMENT AND EMAIL PROCESSING
  const handleSave = async () => {
    console.log(
      "Saving selected resources, processing documents and emails first..."
    );

    if (selectedResources.length === 0) {
      onSelectResources([]);
      onOpenChange(false);
      return;
    }

    // Show saving state
    setIsSaving(true);

    try {
      // Split resources by type for processing
      const fileResources = selectedResources.filter(
        (r) => (r.type === "file" || r.type === "files") && !r.content
      );
      const emailResources = selectedResources.filter(
        (r) => r.type === "email" && !r.content
      );
      const alreadyProcessedResources = selectedResources.filter(
        (r) =>
          r.content ||
          (r.type !== "file" && r.type !== "files" && r.type !== "email")
      );

      // Log processing details
      console.log(`Processing resources:
        - Files to process: ${fileResources.length}
        - Emails to process: ${emailResources.length}
        - Already processed: ${alreadyProcessedResources.length}
      `);

      let toastMessage = "";
      if (fileResources.length > 0 && emailResources.length > 0) {
        toastMessage = `Analyserer ${fileResources.length} ${fileResources.length === 1 ? "dokument" : "dokumenter"} og ${emailResources.length} ${emailResources.length === 1 ? "e-post" : "e-poster"}...`;
      } else if (fileResources.length > 0) {
        toastMessage = `Analyserer ${fileResources.length} ${fileResources.length === 1 ? "dokument" : "dokumenter"}...`;
      } else if (emailResources.length > 0) {
        toastMessage = `Analyserer ${emailResources.length} ${emailResources.length === 1 ? "e-post" : "e-poster"}...`;
      }

      if (toastMessage) {
        toast({
          title: "Behandler ressurser",
          description: toastMessage,
          duration: 3000,
        });
      }

      // Process files and emails in parallel
      const processedFiles =
        fileResources.length > 0
          ? await Promise.all(
              fileResources.map((resource) => processDocumentContent(resource))
            )
          : [];

      const processedEmails =
        emailResources.length > 0
          ? await Promise.all(
              emailResources.map(async (resource) => {
                console.log(
                  `Starting email content processing for: ${resource.subject || resource.name}, ID: ${resource.id}`
                );
                const result = await processEmailContent(resource);
                console.log(
                  `Email processing completed for: ${resource.subject || resource.name}`
                );
                console.log(
                  `Email content extracted: ${result.content ? "Yes" : "No"}, length: ${result.content?.length || 0} characters`
                );
                return result;
              })
            )
          : [];

      // Combine all processed resources
      const allProcessedResources = [
        ...alreadyProcessedResources,
        ...processedFiles,
        ...processedEmails,
      ];

      console.log(
        `Processed ${processedFiles.length} files and ${processedEmails.length} emails, returning ${allProcessedResources.length} total resources`
      );

      // Log processing results
      [...processedFiles, ...processedEmails].forEach((resource) => {
        if (resource.content) {
          console.log(
            `Successfully extracted content from "${resource.name}" (${resource.type}, ${resource.content.length} characters)`
          );
        } else {
          console.log(
            `No content extracted from "${resource.name}" (${resource.type})`
          );
        }
      });

      // Return all resources with content
      onSelectResources(allProcessedResources);

      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing resources:", error);
      toast({
        title: "Behandling feilet",
        description:
          "Det oppsto en feil under behandling av dokumenter eller e-poster. Prøv igjen senere.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Format date string
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle>Select Resource</DialogTitle>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs
            defaultValue="email"
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "email" | "file")}
            className="flex-1 flex flex-col"
          >
            <div className="border-b">
              <TabsList className="w-full justify-start bg-transparent p-0">
                <TabsTrigger
                  value="email"
                  className="px-5 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none"
                >
                  Emails
                </TabsTrigger>
                <TabsTrigger
                  value="file"
                  className="px-5 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none"
                >
                  Files
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-hidden flex flex-col">
                <TabsContent
                  value="email"
                  className="h-full m-0 flex-1 overflow-hidden"
                >
                  <ScrollArea
                    className={`${
                      selectedResources.length > 0 ? "h-[300px]" : "h-[380px]"
                    } p-4`}
                  >
                    {isLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-3">
                        {searchResults.map((email) => (
                          <motion.div
                            key={email.id || `email-${email.webUrl}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-3 rounded-md border cursor-pointer transition-colors ${
                              selectedResources.some((r) => r.id === email.id)
                                ? "border-primary/50 bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/30"
                            }`}
                            onClick={() => toggleResourceSelection(email)}
                          >
                            <div className="flex justify-between">
                              <div className="flex gap-3 items-center">
                                <Mail className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {email.subject ||
                                      email.name ||
                                      "No subject"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {email.from?.emailAddress?.name ||
                                      email.from?.emailAddress?.address ||
                                      // Handle alternate format
                                      (email.from as any)?.name ||
                                      (email.from as any)?.email ||
                                      "Unknown"}
                                  </div>
                                  {/* Show email preview if available */}
                                  {email.preview && (
                                    <div className="text-xs text-gray-500 mt-2 line-clamp-2 bg-gray-50 p-1.5 rounded-sm border-l-2 border-gray-200">
                                      {email.preview}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {email.receivedDateTime
                                  ? formatDate(email.receivedDateTime)
                                  : ""}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : searchQuery ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Search className="h-10 w-10 mb-2 opacity-20" />
                        <p>No emails found for &ldquo;{searchQuery}&rdquo;</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Search className="h-10 w-10 mb-2 opacity-20" />
                        <p>Search for emails</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="file"
                  className="h-full m-0 flex-1 overflow-hidden"
                >
                  <ScrollArea
                    className={`${
                      selectedResources.length > 0 ? "h-[300px]" : "h-[380px]"
                    } p-4`}
                  >
                    {isLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-3">
                        {searchResults.map((file) => (
                          <motion.div
                            key={file.id || `file-${file.webUrl || file.url}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-3 rounded-md border cursor-pointer transition-colors ${
                              selectedResources.some((r) => r.id === file.id)
                                ? "border-primary/50 bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/30"
                            }`}
                            onClick={() => toggleResourceSelection(file)}
                          >
                            <div className="flex justify-between">
                              <div className="flex gap-3 items-center">
                                <File className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {file.size
                                      ? `${Math.round(file.size / 1024)} KB`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {file.lastModifiedDateTime
                                  ? formatDate(file.lastModifiedDateTime)
                                  : ""}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : searchQuery ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Search className="h-10 w-10 mb-2 opacity-20" />
                        <p>No files found for &ldquo;{searchQuery}&rdquo;</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Search className="h-10 w-10 mb-2 opacity-20" />
                        <p>Search for files</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </div>
            </div>
          </Tabs>

          {/* Selected resources display */}
          {selectedResources.length > 0 && (
            <div className="p-4 border-t bg-muted/10">
              <h3 className="text-sm font-medium mb-2">
                Selected items ({selectedResources.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedResources.map((resource) => (
                  <div
                    key={
                      resource.id ||
                      `resource-${
                        resource.webUrl ||
                        resource.url ||
                        Math.random().toString()
                      }`
                    }
                    className="flex items-center gap-1 bg-muted/50 py-1 px-2 rounded-md text-xs"
                  >
                    {resource.type === "email" ? (
                      <Mail className="h-3 w-3" />
                    ) : (
                      <File className="h-3 w-3" />
                    )}
                    <span className="max-w-[200px] truncate">
                      {resource.name}
                      {resource.content ? " (innhold hentet)" : ""}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedResource(resource.id);
                      }}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 pt-6 pb-8 border-t flex justify-between items-center mt-auto">
            <div className="flex items-center">
              <Button variant="outline" size="sm" className="gap-1">
                <Upload className="h-3 w-3" />
                <span>Upload new</span>
              </Button>
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-1 border-background mr-2"></div>
                    Behandler...
                  </>
                ) : (
                  <>
                    Save{" "}
                    {selectedResources.length > 0
                      ? `(${selectedResources.length})`
                      : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
