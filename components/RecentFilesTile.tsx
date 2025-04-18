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
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { RecentFile } from "@/lib/microsoft-graph";
import { FileDialog } from "@/components/FileDialog";
import { cn } from "@/lib/utils";

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

export function RecentFilesTile({ 
  files, 
  isLoading, 
  isCachedData = false,
  onRefresh 
}: RecentFilesTileProps) {
  const [selectedFile, setSelectedFile] = useState<RecentFile | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
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
                  onClick={() => setSelectedFile(file)}
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
      {selectedFile && (
        <FileDialog
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </Card>
  );
}
