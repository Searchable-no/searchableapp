"use client";

import { useState } from "react";
import { 
  FileText, 
  ChevronRight, 
  Clock, 
  User,
  File,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileImage,
  Archive,
  RefreshCw,
  Loader2,
  Check,
  Copy,
  FileIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { RecentFile } from "@/lib/microsoft-graph";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SharePointSearchResult } from "./SearchResults";

interface RecentFilesTileProps {
  files: RecentFile[];
  isLoading: boolean;
  isCachedData?: boolean;
  onRefresh?: () => Promise<void>;
}

function formatFileSize(bytes: number | undefined): string {
  if (typeof bytes !== "number" || isNaN(bytes)) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getFileExtension(filename: string | undefined): string {
  if (!filename) return "FILE";
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toUpperCase() || "FILE" : "FILE";
}

function getFileNameWithoutExtension(filename: string | undefined): string {
  if (!filename) return "Untitled";
  const parts = filename.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : filename;
}

// Function to get the appropriate file icon based on extension
function getFileIcon(filename: string) {
  const ext = getFileExtension(filename).toLowerCase();
  
  switch (ext) {
    case "docx":
    case "doc":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-blue-50 text-blue-500 rounded">
          <FileText size={12} />
        </div>
      );
    case "xlsx":
    case "xls":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-500 rounded">
          <FileSpreadsheet size={12} />
        </div>
      );
    case "pptx":
    case "ppt":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-orange-50 text-orange-500 rounded">
          <Presentation size={12} />
        </div>
      );
    case "pdf":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-red-50 text-red-500 rounded">
          <File size={12} />
        </div>
      );
    case "txt":
    case "csv":
    case "json":
    case "md":
    case "html":
    case "css":
    case "js":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-slate-50 text-slate-500 rounded">
          <FileCode size={12} />
        </div>
      );
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-violet-50 text-violet-500 rounded">
          <FileImage size={12} />
        </div>
      );
    case "zip":
    case "rar":
    case "7z":
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-amber-50 text-amber-500 rounded">
          <Archive size={12} />
        </div>
      );
    default:
      return (
        <div className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded">
          <File size={12} />
        </div>
      );
  }
}

// Helper function to convert RecentFile to SharePointSearchResult format
export function convertToSearchResult(file: RecentFile): SharePointSearchResult {
  return {
    id: file.id,
    name: file.name,
    type: getFileExtension(file.name).toLowerCase(),
    size: file.size,
    lastModifiedBy: file.lastModifiedBy,
    webUrl: file.webUrl,
    driveId: file.parentReference?.driveId,
    lastModifiedDateTime: file.lastModifiedDateTime,
    // Additional fields that might be needed
    path: file.webUrl,
    source: "OneDrive",
    // Set createdBy to the same as lastModifiedBy since RecentFile doesn't have createdBy
    createdBy: file.lastModifiedBy
  };
}

// Export the file handling functions to be used from other components
export async function handleFilePreview(file: RecentFile): Promise<string | null> {
  try {
    const fileResult = convertToSearchResult(file);
    
    // Determine the driveId
    let driveId = fileResult.driveId;

    // If no driveId is provided directly, try to extract it from the file ID
    if (!driveId && fileResult.id) {
      if (fileResult.id.includes("!")) {
        [driveId] = fileResult.id.split("!");
      } else if (fileResult.id.includes(",")) {
        [driveId] = fileResult.id.split(",");
      }
    }

    // If we still don't have a driveId and it's a SharePoint file, use the default Documents library ID
    if (!driveId && fileResult.webUrl?.includes("sharepoint.com")) {
      driveId = "b!6ouVabiacEOJOIH3ZtBNuQxkdvT6fHlLgWYCa3Nzj0o";
    }

    if (!driveId || !fileResult.id) {
      console.error("No driveId or fileId available for file:", fileResult);
      return null;
    }

    const response = await fetch(
      `/api/preview?fileId=${encodeURIComponent(
        fileResult.id
      )}&driveId=${encodeURIComponent(driveId)}`
    );

    if (!response.ok) {
      throw new Error(`Preview request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.previewUrl) {
      throw new Error("No preview URL returned");
    }

    return data.previewUrl;
  } catch (error) {
    console.error("Failed to get preview URL:", error);
    // Fallback to webUrl if preview fails
    if (file.webUrl) {
      return file.webUrl;
    }
    return null;
  }
}

export function RecentFilesTile({ 
  files, 
  isLoading, 
  isCachedData = false,
  onRefresh 
}: RecentFilesTileProps) {
  const [selectedFile, setSelectedFile] = useState<SharePointSearchResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFileSelect = async (file: RecentFile) => {
    const fileResult = convertToSearchResult(file);
    setSelectedFile(fileResult);

    try {
      // Determine the driveId
      let driveId = fileResult.driveId;

      // If no driveId is provided directly, try to extract it from the file ID
      if (!driveId && fileResult.id) {
        if (fileResult.id.includes("!")) {
          [driveId] = fileResult.id.split("!");
        } else if (fileResult.id.includes(",")) {
          [driveId] = fileResult.id.split(",");
        }
      }

      // If we still don't have a driveId and it's a SharePoint file, use the default Documents library ID
      if (!driveId && fileResult.webUrl?.includes("sharepoint.com")) {
        driveId = "b!6ouVabiacEOJOIH3ZtBNuQxkdvT6fHlLgWYCa3Nzj0o";
      }

      if (!driveId || !fileResult.id) {
        console.error("No driveId or fileId available for file:", fileResult);
        return;
      }

      const response = await fetch(
        `/api/preview?fileId=${encodeURIComponent(
          fileResult.id
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
      if (fileResult.webUrl) {
        setPreviewUrl(fileResult.webUrl);
      }
    }
  };

  const handleDialogClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-1 px-2 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="p-0.5 rounded-md bg-primary/10">
                <FileText className="h-3 w-3 text-primary" />
              </div>
              <span>Recent Files</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1.5 flex-1 overflow-hidden">
          <div className="space-y-1.5">
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-14 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "h-full bg-gradient-to-br from-background to-muted/50 flex flex-col",
      isCachedData && "border-dashed"
    )}>
      <CardHeader className={cn(
        "py-1 px-2 border-b flex-none",
        isCachedData && "bg-muted/20"
      )}>
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className={cn(
              "p-0.5 rounded-md bg-primary/10",
              isCachedData && "bg-muted/30"
            )}>
              <FileText className={cn(
                "h-3 w-3 text-primary",
                isCachedData && "text-muted-foreground"
              )} />
            </div>
            <span className="truncate">Recent Files</span>
            {isCachedData && (
              <span className="text-[8px] px-1 py-0.5 rounded-sm bg-muted/30 text-muted-foreground ml-0.5 hidden sm:inline-block">
                Cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 rounded-full hover:bg-muted/50"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
            {files.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5 rounded-md hover:bg-muted/50"
                onClick={() =>
                  window.open("https://www.office.com/launch/files", "_blank")
                }
              >
                OneDrive
                <ChevronRight className="ml-0.5 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1.5 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-5 w-5 mb-1.5 opacity-50" />
            <p className="text-xs">No recent files</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {files.map((file) => {
              const fileName = getFileNameWithoutExtension(file.name);
              return (
                <div
                  key={file.id}
                  className="group px-1.5 py-1 rounded-md border hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="flex items-start gap-1.5">
                    {getFileIcon(file.name)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="text-xs font-medium truncate">
                            {fileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[9px] text-muted-foreground">
                            <div className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              <span className="truncate">
                                {formatDate(file.lastModifiedDateTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 truncate max-w-[100px]">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">
                                {file.lastModifiedBy.user.displayName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-1">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Use the same dialog component as in SearchResults */}
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
                        {selectedFile?.type.toUpperCase()}
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
                        {selectedFile?.source || "OneDrive"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">URL</dt>
                      <dd className="font-medium break-all flex items-start gap-2">
                        {selectedFile?.webUrl ? (
                          <>
                            <a 
                              href={selectedFile.webUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline cursor-pointer flex-grow"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(selectedFile.webUrl, "_blank");
                              }}
                            >
                              {selectedFile.webUrl}
                            </a>
                            <button
                              className={`flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors ${copied ? 'text-green-500' : 'text-muted-foreground'}`}
                              onClick={() => selectedFile?.webUrl && copyToClipboard(selectedFile.webUrl)}
                              title="Copy URL to clipboard"
                            >
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </>
                        ) : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold mb-2">Actions</h3>

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

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      if (selectedFile?.webUrl) {
                        // This can open the file in client application via Office protocols
                        // E.g. ms-word:ofv|u|https://...
                        const url = selectedFile.webUrl;
                        let protocol = "ms-office:ofe|u|";

                        // Determine protocol based on file type
                        if (
                          selectedFile.name.endsWith(".docx") ||
                          selectedFile.name.endsWith(".doc")
                        ) {
                          protocol = "ms-word:ofe|u|";
                        } else if (
                          selectedFile.name.endsWith(".xlsx") ||
                          selectedFile.name.endsWith(".xls")
                        ) {
                          protocol = "ms-excel:ofe|u|";
                        } else if (
                          selectedFile.name.endsWith(".pptx") ||
                          selectedFile.name.endsWith(".ppt")
                        ) {
                          protocol = "ms-powerpoint:ofe|u|";
                        }

                        window.location.href = protocol + url;
                      }
                    }}
                  >
                    Open in Client Application
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
