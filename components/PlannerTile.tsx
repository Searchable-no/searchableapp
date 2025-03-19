"use client";

import { useState, useEffect } from "react";
import { ListTodo, ChevronRight, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlannerTask } from "@/lib/microsoft-graph";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { refreshTileData } from "@/app/dashboard/actions";
import { toast } from "sonner";

interface PlannerTileProps {
  tasks?: PlannerTask[];
  isLoading?: boolean;
  refreshInterval?: number;
  onRefresh?: () => Promise<void>;
  isCachedData?: boolean;
  userId?: string;
}

export function PlannerTile({
  tasks = [],
  isLoading: initialLoading = false,
  refreshInterval = 300000, // Default to 5 minutes
  onRefresh,
  isCachedData = false,
  userId,
}: PlannerTileProps) {
  // Use tasks prop as initial state for localTasks
  const [localTasks, setLocalTasks] = useState<PlannerTask[]>(tasks);
  const [isLoading, setIsLoading] = useState(false); // Start with not loading
  const [isRefreshingTile, setIsRefreshingTile] = useState(false);
  const router = useRouter();
  
  // Initialize component with tasks when they change
  useEffect(() => {
    console.log(`PLANNER: Received ${tasks?.length || 0} tasks, isCached: ${isCachedData}, isLoading: ${initialLoading}`);
    
    // Always update local tasks when new ones arrive
    if (tasks?.length > 0) {
      setLocalTasks(tasks);
    }
    
    // Only show loading if we have no tasks and are explicitly not using cached data
    if (tasks?.length === 0 && !isCachedData && initialLoading) {
      console.log('PLANNER: Setting loading state because no tasks and not cached');
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [tasks, isCachedData, initialLoading]);
  
  const { isRefreshing, refresh } = useAutoRefresh({
    refreshInterval,
    onRefresh: async () => {
      if (onRefresh) {
        await performRefresh();
      }
    },
  });

  const performRefresh = async () => {
    try {
      console.log('PLANNER: Starting tile refresh');
      setIsRefreshingTile(true);
      
      if (onRefresh) {
        console.log('PLANNER: Using parent onRefresh function');
        await onRefresh();
      } else if (userId) {
        console.log('PLANNER: Using direct refreshTileData');
        // If no onRefresh provided but we have userId, use refreshTileData
        const result = await refreshTileData("planner");
        if (result.plannerTasks?.length) {
          console.log(`PLANNER: Refreshed ${result.plannerTasks.length} planner tasks`);
          setLocalTasks(result.plannerTasks);
          toast.success('Planner tasks refreshed');
        } else {
          console.log('PLANNER: No planner tasks returned from refresh');
          if (result.error) {
            toast.error(`Failed to refresh: ${result.error}`);
          }
        }
      }
    } catch (error) {
      console.error("PLANNER: Error refreshing planner tasks:", error);
      toast.error("Failed to refresh tasks");
    } finally {
      console.log('PLANNER: Refresh complete');
      setIsRefreshingTile(false);
    }
  };

  // Determine if we should show the loading state
  const showLoadingState = isLoading || isRefreshingTile && localTasks.length === 0;
  
  // Use either cached tasks if that's what we have, or fresh tasks
  const displayTasks = localTasks.length > 0 ? localTasks : tasks;

  if (showLoadingState) {
    console.log('PLANNER: Rendering loading state');
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
    <Card className={cn(
      "h-full bg-gradient-to-br from-background to-muted/50 flex flex-col",
      isCachedData && "border-dashed"
    )}>
      <CardHeader className={cn(
        "py-1.5 px-2.5 border-b flex-none",
        isCachedData && "bg-muted/20"
      )}>
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "p-1 rounded-md bg-primary/10",
              isCachedData && "bg-muted/30"
            )}>
              <ListTodo className={cn(
                "h-3 w-3 text-primary",
                isCachedData && "text-muted-foreground"
              )} />
            </div>
            <span>Planner Tasks</span>
            {isCachedData && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted/30 text-muted-foreground ml-1">
                Cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md hover:bg-muted/50"
              onClick={performRefresh}
              disabled={isRefreshing || isRefreshingTile}
            >
              <RotateCw
                className={cn("h-3 w-3", (isRefreshing || isRefreshingTile) && "animate-spin")}
              />
              <span className="sr-only">Refresh tasks</span>
            </Button>
            {displayTasks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 rounded-md hover:bg-muted/50"
                onClick={() => window.open("https://tasks.office.com", "_blank")}
              >
                Open Planner
                <ChevronRight className="ml-1 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex-1 overflow-y-auto">
        {displayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ListTodo className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-xs">No tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "group p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
                  isCachedData && "opacity-90"
                )}
                onClick={() => router.push(`/planner/task/${task.id}`)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <ListTodo className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-medium truncate">
                          {task.title}
                        </p>
                        {task.planTitle && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
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
                      <div className="mt-1.5 flex items-center gap-1.5">
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
