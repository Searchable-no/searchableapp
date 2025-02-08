"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RecentFile } from "@/lib/microsoft-graph";
import {
  FileText,
  Clock,
  User,
  Download,
  ExternalLink,
  FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import React from "react";

// Add interface for parent reference
interface ParentReference {
  driveId?: string;
}

// Extend RecentFile interface
interface FileDialogProps {
  file: RecentFile & { parentReference?: ParentReference };
  isOpen: boolean;
  onClose: () => void;
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

function getPreviewUrl(file: RecentFile): string | null {
  const ext = getFileExtension(file.name).toLowerCase();
  console.log("Processing file:", {
    name: file.name,
    id: file.id,
    webUrl: file.webUrl,
    parentReference: file.parentReference,
  });

  // For supported file types, use the preview API
  if (
    [
      // Office documents
      "docx",
      "xlsx",
      "pptx",
      "doc",
      "xls",
      "ppt",
      // PDFs and images
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "gif",
      "bmp",
      // Text files
      "txt",
      "csv",
      "md",
      "json",
      "xml",
      "html",
      "css",
      "js",
    ].includes(ext)
  ) {
    // Extract driveId and fileId from the file object
    let driveId, fileId;

    if (file.webUrl?.includes("sourcedoc=")) {
      // For SharePoint files, extract the document ID from the URL
      const url = new URL(file.webUrl);
      const sourcedoc = url.searchParams.get("sourcedoc") || "";
      // Remove curly braces and convert to base64
      const docId = sourcedoc.replace(/[{}]/g, "");
      driveId = `b!${Buffer.from(docId).toString("base64").replace(/=/g, "")}`;
      fileId = file.id;
      console.log("SharePoint file detected:", { docId, driveId, fileId });
    } else if (file.id.includes("!")) {
      [driveId, fileId] = file.id.split("!");
      console.log("OneDrive file detected:", { driveId, fileId });
    } else if (file.id.includes(",")) {
      [driveId, fileId] = file.id.split(",");
      console.log("SharePoint list file detected:", { driveId, fileId });
    } else if (file.parentReference?.driveId) {
      driveId = file.parentReference.driveId;
      fileId = file.id;
      console.log("Using parent reference:", { driveId, fileId });
    } else if (file.webUrl?.includes("sharepoint.com")) {
      // For files in the root site's Shared Documents library
      // Use the drive ID from the file's URL
      const url = new URL(file.webUrl);
      const pathParts = url.pathname.split("/");
      const docLibIndex = pathParts.indexOf("Shared%20Documents");
      if (docLibIndex !== -1) {
        driveId = "b!6ouVabiacEOJOIH3ZtBNuQxkdvT6fHlLgWYCa3Nzj0o";
        fileId = file.id;
        console.log("SharePoint Shared Documents:", {
          driveId,
          fileId,
          path: url.pathname,
        });
      }
    }

    if (!driveId || !fileId) {
      console.warn("Missing drive ID or file ID:", {
        file,
        driveId,
        fileId,
        webUrl: file.webUrl,
        parentRef: file.parentReference,
      });
      return null;
    }

    return `/api/preview?fileId=${encodeURIComponent(
      fileId
    )}&driveId=${encodeURIComponent(driveId)}`;
  }

  return null;
}

export function FileDialog({ file, isOpen, onClose }: FileDialogProps) {
  const fileExt = getFileExtension(file.name);
  const previewApiUrl = getPreviewUrl(file);
  const descriptionId = React.useId();
  const [previewError, setPreviewError] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(true);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const isOfficeFile = ["docx", "xlsx", "pptx", "doc", "xls", "ppt"].includes(
    fileExt.toLowerCase()
  );

  React.useEffect(() => {
    if (!previewApiUrl) {
      setPreviewLoading(false);
      return;
    }

    fetch(previewApiUrl)
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          console.error("Preview API error:", error);
          throw new Error(
            error.error?.message || "Failed to fetch preview URL"
          );
        }
        return res.json();
      })
      .then((data) => {
        console.log("Preview URL received:", data);
        setPreviewUrl(data.previewUrl);
        setPreviewError(false);
      })
      .catch((err) => {
        console.error("Preview error:", err);
        setPreviewError(true);
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [previewApiUrl]);

  const handleIframeLoad = () => {
    setPreviewLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl h-[80vh] flex flex-col p-0"
        aria-describedby={descriptionId}
      >
        <DialogHeader className="px-4 py-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded">
              <FileText className="h-3 w-3" />
            </div>
            <span className="truncate">{file.name}</span>
          </DialogTitle>
          <DialogDescription id={descriptionId} className="sr-only">
            Preview and details for {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* File Details */}
          <div className="px-4 py-2 space-y-2 border-b">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Modified {formatDate(file.lastModifiedDateTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{file.lastModifiedBy.user.displayName}</span>
              </div>
              <div>{formatFileSize(file.size)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(file.webUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in OneDrive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  window.open(
                    file.webUrl.replace("view.aspx", "download.aspx"),
                    "_blank"
                  )
                }
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>

          {/* File Preview */}
          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            {previewApiUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-white rounded-lg border relative">
                {previewUrl && !previewError && (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full rounded-lg"
                    frameBorder="0"
                    title={file.name}
                    onError={() => setPreviewError(true)}
                    onLoad={handleIframeLoad}
                    allow="fullscreen"
                    sandbox={
                      isOfficeFile
                        ? "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-popups-to-escape-sandbox"
                        : undefined
                    }
                  />
                )}
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
                {previewError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-muted-foreground gap-2">
                    <FileIcon className="h-12 w-12" />
                    <p>Preview failed to load</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => window.open(file.webUrl, "_blank")}
                    >
                      Open in OneDrive
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <FileIcon className="h-12 w-12" />
                <p>Preview not available for this file type</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open(file.webUrl, "_blank")}
                >
                  Open in OneDrive
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
