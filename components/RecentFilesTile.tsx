"use client";

import { useState } from "react";
import { FileText, ChevronRight, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { RecentFile } from "@/lib/microsoft-graph";
import { FileDialog } from "@/components/FileDialog";

interface RecentFilesTileProps {
  files: RecentFile[];
  isLoading: boolean;
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

export function RecentFilesTile({ files, isLoading }: RecentFilesTileProps) {
  const [selectedFile, setSelectedFile] = useState<RecentFile | null>(null);

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-2 px-3 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>Recent Files</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 flex-1">
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
            <div className="h-16 animate-pulse rounded-lg bg-muted/60"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <CardHeader className="py-2 px-3 border-b flex-none">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Recent Files</span>
          </div>
          {files.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 rounded-md hover:bg-muted/50"
              onClick={() =>
                window.open("https://www.office.com/launch/files", "_blank")
              }
            >
              Open OneDrive
              <ChevronRight className="ml-1 h-2 w-2" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No recent files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => {
              const fileExt = getFileExtension(file.name);
              const fileName = getFileNameWithoutExtension(file.name);
              return (
                <div
                  key={file.id}
                  className="group p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <span className="text-xs font-medium">{fileExt}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium truncate">
                            {fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDate(file.lastModifiedDateTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {file.lastModifiedBy.user.displayName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
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
