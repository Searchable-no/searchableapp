"use client";

import { useState } from "react";
import { ListTodo, ChevronRight, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlannerTask } from "@/lib/microsoft-graph";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";

interface PlannerTileProps {
  tasks?: PlannerTask[];
  isLoading?: boolean;
  refreshInterval?: number;
  onRefresh?: () => Promise<void>;
}

export function PlannerTile({
  tasks = [],
  isLoading: initialLoading,
  refreshInterval = 300000, // Default to 5 minutes
  onRefresh,
}: PlannerTileProps) {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const { isRefreshing, refresh } = useAutoRefresh({
    refreshInterval,
    onRefresh: async () => {
      if (!onRefresh) return;
      setIsLoading(true);
      try {
        await onRefresh();
      } finally {
        setIsLoading(false);
      }
    },
  });

  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-background to-muted/50 flex flex-col">
        <CardHeader className="py-2 px-3 border-b flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <ListTodo className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>Planner Tasks</span>
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
              <ListTodo className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Planner Tasks</span>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-muted/50"
                onClick={() => refresh()}
                disabled={isRefreshing}
              >
                <RotateCw
                  className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
                />
                <span className="sr-only">Refresh tasks</span>
              </Button>
            )}
            {tasks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 rounded-md hover:bg-muted/50"
                onClick={() =>
                  window.open("https://tasks.office.com", "_blank")
                }
              >
                Open Planner
                <ChevronRight className="ml-1 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ListTodo className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="group p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => window.open(task.webUrl, "_blank")}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <ListTodo className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium truncate">
                          {task.title}
                        </p>
                        {task.planTitle && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.planTitle}
                          </p>
                        )}
                      </div>
                      {task.dueDateTime && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          Due {new Date(task.dueDateTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {task.percentComplete > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300 ease-in-out"
                            style={{ width: `${task.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {task.percentComplete}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
