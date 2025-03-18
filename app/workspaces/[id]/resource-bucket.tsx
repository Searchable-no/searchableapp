"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ResourceDragItem } from "./resource-drag-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkspaceResource {
  id: string;
  workspace_id: string;
  resource_type: "sharepoint" | "teams" | "planner";
  resource_id: string;
  resource_name: string;
  resource_url?: string;
  bucket?: string;
}

interface ResourceBucketProps {
  id: string;
  title: string;
  resources: WorkspaceResource[];
}

export function ResourceBucket({ id, title, resources }: ResourceBucketProps) {
  // Use droppable to make this component a drop target
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`transition-colors ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="text-xs text-muted-foreground">
          {resources.length} {resources.length === 1 ? "ressurs" : "ressurser"}
        </div>
      </CardHeader>
      <CardContent
        className={`${resources.length === 0 ? "min-h-[100px]" : ""}`}
      >
        {resources.length === 0 ? (
          <div className="flex items-center justify-center h-full py-6 text-center text-muted-foreground">
            <p className="text-sm">Dra ressurser hit</p>
          </div>
        ) : (
          <SortableContext
            items={resources.map((r) => r.id)}
            strategy={rectSortingStrategy}
          >
            {resources.map((resource) => (
              <ResourceDragItem key={resource.id} resource={resource} />
            ))}
          </SortableContext>
        )}
      </CardContent>
    </Card>
  );
}
