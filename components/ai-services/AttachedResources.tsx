import {
  X,
  File,
  Mail,
  FileText,
  FileCode,
  Image,
  Table,
  FileArchive,
} from "lucide-react";
import { motion } from "framer-motion";
import { Microsoft365Resource } from "./ResourcePicker";

interface AttachedResourcesProps {
  resources: Microsoft365Resource[];
  onRemove?: (resourceId: string) => void;
  className?: string;
  readonly?: boolean;
}

export default function AttachedResources({
  resources,
  onRemove,
  className = "",
  readonly = false,
}: AttachedResourcesProps) {
  if (!resources || resources.length === 0) return null;

  // Get appropriate icon for file type
  const getFileIcon = (fileName: string) => {
    if (!fileName) return <File className="h-4 w-4" />;

    const ext = fileName.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "doc":
      case "docx":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "xls":
      case "xlsx":
        return <Table className="h-4 w-4 text-green-500" />;
      case "ppt":
      case "pptx":
        return <FileText className="h-4 w-4 text-orange-500" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return <Image className="h-4 w-4 text-purple-500" />;
      case "zip":
      case "rar":
      case "7z":
        return <FileArchive className="h-4 w-4 text-gray-500" />;
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "html":
      case "css":
      case "json":
        return <FileCode className="h-4 w-4 text-yellow-500" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  // Format file size
  const formatFileSize = (size?: number) => {
    if (!size) return "";

    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs text-muted-foreground">
        Attached {resources.length} {resources.length === 1 ? "item" : "items"}
      </div>
      <div className="flex flex-wrap gap-2">
        {resources.map((resource) => (
          <motion.div
            key={resource.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-md py-2 px-3"
          >
            {resource.type === "email" ? (
              <Mail className="h-4 w-4 text-blue-500" />
            ) : (
              getFileIcon(resource.name)
            )}

            <div>
              <div className="font-medium text-sm truncate max-w-[150px]">
                {resource.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {resource.type === "email"
                  ? resource.from?.emailAddress?.name ||
                    resource.from?.emailAddress?.address ||
                    "Unknown"
                  : formatFileSize(resource.size)}
              </div>
            </div>

            {!readonly && onRemove && (
              <button
                onClick={() => onRemove(resource.id)}
                className="ml-1 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
