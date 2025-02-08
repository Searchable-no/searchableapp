"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileIcon, Loader2 } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  ListTodo,
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  FileCode,
  FileImage,
  Archive,
} from "lucide-react";

// Helper function to determine source based on type and path
function getSource(result: SharePointSearchResult): string {
  // If source is explicitly provided, use it
  if (result.source) return result.source;

  // Handle different types
  switch (result.type.toUpperCase()) {
    case "PLANNER":
      return "Microsoft Planner";
    case "FILE":
      // Check path for source hints
      if (result.path) {
        if (result.path.toLowerCase().includes("/onedrive/")) return "OneDrive";
        if (result.path.toLowerCase().includes("/sharepoint/"))
          return "SharePoint";
        if (result.path.toLowerCase().includes("/sites/")) return "SharePoint";
        if (result.path.toLowerCase().includes("/personal/")) return "OneDrive";
      }
      // Check webUrl for source hints
      if (result.webUrl) {
        if (result.webUrl.toLowerCase().includes("-my.sharepoint.com"))
          return "OneDrive";
        if (result.webUrl.toLowerCase().includes(".sharepoint.com"))
          return "SharePoint";
      }
      return "SharePoint"; // Default to SharePoint if no other source is determined
    default:
      return "Unknown";
  }
}

// Helper function to format the type display
function formatType(type: string): string {
  switch (type.toLowerCase()) {
    case "email":
      return "Email";
    case "chat":
      return "Teams Chat";
    case "channel":
      return "Teams Channel";
    case "planner":
    case "PLANNER":
      return "Task";
    case "folder":
      return "Folder";
    case "file":
      return "Document";
    default:
      // If it's not a special type, return the original type in uppercase
      return type.toUpperCase();
  }
}

export interface SharePointSearchResult {
  id: string;
  name: string;
  type: string;
  size: number;
  createdBy?: {
    user?: {
      displayName?: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      displayName?: string;
    };
  };
  source?: string;
  path?: string;
  webUrl?: string;
  driveId?: string;
  lastModifiedDateTime: string;
}

interface SearchResultsProps {
  results: SharePointSearchResult[];
  isLoading: boolean;
  error: string | null;
}

// Helper function to get the appropriate icon for each content type
function getResultIcon(result: SharePointSearchResult) {
  // First check the type
  switch (result.type.toLowerCase()) {
    case "email":
      return <Mail className="h-4 w-4 text-sky-400" />;
    case "chat":
      return <MessageSquare className="h-4 w-4 text-indigo-400" />;
    case "channel":
      return <MessageCircle className="h-4 w-4 text-indigo-400" />;
    case "planner":
      return <ListTodo className="h-4 w-4 text-rose-400" />;
    case "folder":
      return <Folder className="h-4 w-4 text-amber-400" />;
    default:
      // For files, check the extension
      const extension = result.name.split(".").pop()?.toLowerCase();
      switch (extension) {
        case "docx":
        case "doc":
          return <FileText className="h-4 w-4 text-blue-400" />;
        case "xlsx":
        case "xls":
          return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
        case "pptx":
        case "ppt":
          return <Presentation className="h-4 w-4 text-orange-400" />;
        case "pdf":
          return <File className="h-4 w-4 text-red-400" />;
        case "txt":
          return <FileCode className="h-4 w-4 text-slate-400" />;
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
          return <FileImage className="h-4 w-4 text-violet-400" />;
        case "zip":
        case "rar":
        case "7z":
          return <Archive className="h-4 w-4 text-amber-400" />;
        default:
          return <File className="h-4 w-4 text-slate-400" />;
      }
  }
}

export function SearchResults({
  results,
  isLoading,
  error,
}: SearchResultsProps) {
  const [selectedFile, setSelectedFile] =
    useState<SharePointSearchResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(i);
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pages.push("...");
      }
    }
    return pages;
  };

  const handleFileSelect = async (file: SharePointSearchResult) => {
    setSelectedFile(file);
    try {
      // Determine the driveId
      let driveId = file.driveId;

      // If no driveId is provided directly, try to extract it from the file ID
      if (!driveId && file.id) {
        if (file.id.includes("!")) {
          [driveId] = file.id.split("!");
        } else if (file.id.includes(",")) {
          [driveId] = file.id.split(",");
        }
      }

      // If we still don't have a driveId and it's a SharePoint file, use the default Documents library ID
      if (!driveId && file.webUrl?.includes("sharepoint.com")) {
        driveId = "b!6ouVabiacEOJOIH3ZtBNuQxkdvT6fHlLgWYCa3Nzj0o";
      }

      if (!driveId || !file.id) {
        console.error("No driveId or fileId available for file:", file);
        return;
      }

      const response = await fetch(
        `/api/preview?fileId=${encodeURIComponent(
          file.id
        )}&driveId=${encodeURIComponent(driveId)}`
      );

      if (!response.ok) {
        throw new Error(`Preview request failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.previewUrl) {
        throw new Error("No preview URL returned");
      }

      setPreviewUrl(data.previewUrl);
    } catch (error) {
      console.error("Failed to get preview URL:", error);
      // Fallback to webUrl if preview fails
      if (file.webUrl) {
        setPreviewUrl(file.webUrl);
      }
    }
  };

  const handleDialogClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <p className="text-red-500">{error}</p>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-muted-foreground">No results found</p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        {/* Header */}
        <div className="grid grid-cols-6 gap-4 p-4 font-medium text-sm bg-muted">
          <div className="col-span-2">Name</div>
          <div>Type</div>
          <div>Created By</div>
          <div>Modified By</div>
          <div>Source</div>
        </div>

        {/* Results */}
        <div className="divide-y">
          {currentResults.map((result) => (
            <div
              key={result.id}
              className="grid grid-cols-6 gap-4 p-4 hover:bg-muted/50 cursor-pointer items-center"
              onClick={() => handleFileSelect(result)}
            >
              <div className="col-span-2 flex items-center gap-2">
                {getResultIcon(result)}
                <span className="truncate">{result.name}</span>
              </div>
              <div className="truncate">{formatType(result.type)}</div>
              <div className="truncate">
                {result.createdBy?.user?.displayName || "System"}
              </div>
              <div className="truncate">
                {result.lastModifiedBy?.user?.displayName || "System"}
              </div>
              <div className="truncate">{getSource(result)}</div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className={cn(
                      "cursor-pointer",
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>

                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "..." ? (
                      <span className="px-4 py-2">...</span>
                    ) : (
                      <PaginationLink
                        className="cursor-pointer"
                        isActive={currentPage === page}
                        onClick={() => setCurrentPage(Number(page))}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className={cn(
                      "cursor-pointer",
                      currentPage === totalPages &&
                        "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedFile} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[95vw] w-full h-[98vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 py-3 border-b flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <FileIcon className="h-5 w-5 text-blue-500" />
              <DialogTitle className="text-xl">
                {selectedFile?.name}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Main content area */}
          <div className="flex flex-1 min-h-0 h-full">
            {/* Preview pane */}
            <div className="flex-1 h-full">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="File preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>

            {/* Details sidebar */}
            <div className="w-80 border-l bg-muted/10 p-6 overflow-y-auto h-full">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">File Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium">
                        {selectedFile && formatType(selectedFile.type)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium">
                        {selectedFile && formatFileSize(selectedFile.size)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Created By</dt>
                      <dd className="font-medium">
                        {selectedFile?.createdBy?.user?.displayName || "System"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Modified By</dt>
                      <dd className="font-medium">
                        {selectedFile?.lastModifiedBy?.user?.displayName ||
                          "System"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Source</dt>
                      <dd className="font-medium">
                        {selectedFile && getSource(selectedFile)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Path</dt>
                      <dd className="font-medium break-all">
                        {selectedFile?.path || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    if (selectedFile?.webUrl) {
                      window.open(selectedFile.webUrl, "_blank");
                    }
                  }}
                >
                  Open in Browser
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
