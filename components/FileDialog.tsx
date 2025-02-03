'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RecentFile } from '@/lib/microsoft-graph'
import { FileText, Clock, User, Download, ExternalLink, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import React from 'react'

interface FileDialogProps {
  file: RecentFile
  isOpen: boolean
  onClose: () => void
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

function getPreviewUrl(file: RecentFile): string | null {
  const ext = getFileExtension(file.name).toLowerCase()
  const itemId = file.id
  const driveId = itemId.split('!')[0]
  
  // Office documents and PDFs
  if (['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'pdf'].includes(ext)) {
    // Use Microsoft Graph's preview endpoint
    return `/api/preview/${driveId}/${itemId}`
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
    return `/api/preview/${driveId}/${itemId}`
  }
  
  // Text files
  if (['txt', 'csv', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) {
    return `/api/preview/${driveId}/${itemId}`
  }
  
  return null
}

export function FileDialog({ file, isOpen, onClose }: FileDialogProps) {
  const fileExt = getFileExtension(file.name)
  const previewUrl = getPreviewUrl(file)
  const descriptionId = React.useId()
  const [previewError, setPreviewError] = React.useState(false)
  const [previewLoading, setPreviewLoading] = React.useState(true)
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (previewUrl) {
      fetch(previewUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch preview URL')
          return res.json()
        })
        .then(data => {
          setDownloadUrl(data.url)
          setPreviewError(false)
        })
        .catch(err => {
          console.error('Preview error:', err)
          setPreviewError(true)
        })
        .finally(() => {
          setPreviewLoading(false)
        })
    }
  }, [previewUrl])

  const handleIframeLoad = () => {
    setPreviewLoading(false)
  }

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
              <div>
                {formatFileSize(file.size)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(file.webUrl, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in OneDrive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(file.webUrl.replace('view.aspx', 'download.aspx'), '_blank')}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>

          {/* File Preview */}
          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            {previewUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-white rounded-lg border relative">
                {downloadUrl && !previewError && (
                  <iframe
                    src={downloadUrl}
                    className="w-full h-full rounded-lg"
                    frameBorder="0"
                    title={file.name}
                    onError={() => setPreviewError(true)}
                    onLoad={handleIframeLoad}
                    allow="fullscreen"
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
                    <p className="text-sm">Please use the buttons above to open or download the file</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <FileIcon className="h-12 w-12" />
                <p>Preview not available for this file type</p>
                <p className="text-sm">Please use the buttons above to open or download the file</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 