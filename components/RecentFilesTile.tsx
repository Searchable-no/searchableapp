'use client'

import { useState } from 'react'
import { FileText, ExternalLink, ChevronRight, Clock, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { RecentFile } from '@/lib/microsoft-graph'
import { FileDialog } from '@/components/FileDialog'

interface RecentFilesTileProps {
  files: RecentFile[]
  isLoading: boolean
}

function formatFileSize(bytes: number | undefined): string {
  if (typeof bytes !== 'number' || isNaN(bytes)) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function getFileExtension(filename: string | undefined): string {
  if (!filename) return 'FILE'
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toUpperCase() || 'FILE' : 'FILE'
}

function getFileNameWithoutExtension(filename: string | undefined): string {
  if (!filename) return 'Untitled'
  const parts = filename.split('.')
  return parts.length > 1 ? parts.slice(0, -1).join('.') : filename
}

export function RecentFilesTile({ files, isLoading }: RecentFilesTileProps) {
  const [showAll, setShowAll] = useState(false)
  const [selectedFile, setSelectedFile] = useState<RecentFile | null>(null)
  const displayFiles = showAll ? files : files.slice(0, 5)

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Recent Files
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-auto max-h-[250px]">
          <div className="space-y-1">
            <div className="h-14 animate-pulse rounded bg-muted"></div>
            <div className="h-14 animate-pulse rounded bg-muted"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Recent Files
          </div>
          {files.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs px-2"
              onClick={() => window.open('https://www.office.com/launch/files', '_blank')}
            >
              Open OneDrive
              <ChevronRight className="ml-1 h-2 w-2" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        <div className="space-y-1">
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent files</p>
          ) : (
            <>
              <div className="space-y-1">
                {displayFiles.map((file) => {
                  const fileExt = getFileExtension(file.name)
                  const fileName = getFileNameWithoutExtension(file.name)
                  return (
                    <div 
                      key={file.id} 
                      className="group relative rounded-sm border p-1.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded">
                          <FileText className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium truncate">
                              {fileName}
                            </p>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">
                                {fileExt}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(file.webUrl, '_blank')
                                }}
                              >
                                <ExternalLink className="h-2 w-2" />
                                <span className="sr-only">Open file</span>
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-2 w-2" />
                              <span>{formatDate(file.lastModifiedDateTime)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-2 w-2" />
                              <span className="truncate">{file.lastModifiedBy.user.displayName}</span>
                            </div>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {files.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs h-6"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show ${files.length - 5} More`}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
      {selectedFile && (
        <FileDialog
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </Card>
  )
} 