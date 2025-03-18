"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { File, MessageSquare, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceResource {
  id: string;
  workspace_id: string;
  resource_type: "sharepoint" | "teams" | "planner";
  resource_id: string;
  resource_name: string;
  resource_url?: string;
  bucket?: string;
}

export function ResourceDragItem({
  resource,
  isDragging = false,
}: {
  resource: WorkspaceResource;
  isDragging?: boolean;
}) {
  // Use sortable to make this component draggable
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: resource.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Select the appropriate icon based on resource type
  const ResourceIcon = {
    sharepoint: File,
    teams: MessageSquare,
    planner: ListChecks,
  }[resource.resource_type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md p-4 bg-card border shadow-sm mb-2 cursor-grab",
        isDragging && "opacity-50",
        "hover:border-primary/50 transition-colors"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded text-primary">
          <ResourceIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate mb-1">
            {resource.resource_name}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {resource.resource_type === "sharepoint" && "SharePoint-side"}
            {resource.resource_type === "teams" && "Teams-kanal"}
            {resource.resource_type === "planner" && "Planner-plan"}
          </div>
        </div>
      </div>
    </div>
  );
}
