'use client'

import { useState } from 'react'
import { ListTodo, ExternalLink, ChevronRight, CheckCircle2, Circle, RotateCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { PlannerTask } from '@/lib/microsoft-graph'
import { PlannerTaskDialog } from './PlannerTaskDialog'
import { cn } from '@/lib/utils'
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh'

interface PlannerTileProps {
  tasks?: PlannerTask[]
  isLoading: boolean
  userId: string
  refreshInterval?: number
  onRefresh?: () => Promise<void>
}

export function PlannerTile({ tasks = [], isLoading: initialLoading, userId, refreshInterval, onRefresh }: PlannerTileProps) {
  const [showAllActive, setShowAllActive] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  const { isRefreshing, refresh } = useAutoRefresh({
    refreshInterval: refreshInterval || 300000, // Default to 5 minutes if not specified
    onRefresh: onRefresh || (() => Promise.resolve()),
    enabled: !!onRefresh
  })

  const isLoading = initialLoading || isRefreshing

  const handleTaskUpdate = async () => {
    if (onRefresh) {
      await refresh()
    }
  }

  // Split tasks into active and completed
  const activeTasks = tasks
    .filter(task => task.percentComplete < 100)
    .sort((a, b) => {
      // If both tasks have due dates, compare them
      if (a.dueDateTime && b.dueDateTime) {
        return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime()
      }
      // Tasks with due dates come before tasks without due dates
      if (a.dueDateTime) return -1
      if (b.dueDateTime) return 1
      // If neither has a due date, sort by priority
      return b.priority - a.priority
    })

  const completedTasks = tasks
    .filter(task => task.percentComplete === 100)
    .sort((a, b) => {
      // Sort by most recently completed (using createdDateTime as a proxy since we don't have completion date)
      return new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    })

  // Determine which tasks to display based on show all state
  const displayActiveTasks = showAllActive ? activeTasks : activeTasks.slice(0, 3)
  const displayCompletedTasks = showAllCompleted ? completedTasks : completedTasks.slice(0, 2)

  const TaskItem = ({ task }: { task: PlannerTask }) => (
    <PlannerTaskDialog 
      key={task.id} 
      task={task} 
      userId={userId}
      onTaskUpdate={handleTaskUpdate}
    >
      <div className="group relative rounded-sm border p-1.5 hover:bg-muted/50 cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {task.percentComplete === 100 ? (
              <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
            ) : (
              <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            <p className={cn(
              "text-xs font-medium truncate",
              task.percentComplete === 100 && "text-muted-foreground line-through"
            )}>
              {task.title}
            </p>
            {task.priority > 5 && (
              <span className="text-[10px] text-red-500 font-medium">High Priority</span>
            )}
            {task.dueDateTime && !task.percentComplete && new Date(task.dueDateTime) < new Date() && (
              <span className="text-[10px] text-red-500 font-medium">Overdue</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {task.webUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(task.webUrl, '_blank')
                }}
              >
                <ExternalLink className="h-2 w-2" />
                <span className="sr-only">Open task</span>
              </Button>
            )}
            {task.dueDateTime && (
              <p className={cn(
                "text-[10px] whitespace-nowrap",
                task.percentComplete === 0 && new Date(task.dueDateTime) < new Date() 
                  ? "text-red-500 font-medium"
                  : "text-muted-foreground"
              )}>
                Due {formatDate(task.dueDateTime)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{task.planTitle}</span>
        </div>
      </div>
    </PlannerTaskDialog>
  )

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              Planner Tasks
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
            <ListTodo className="h-3 w-3" />
            Planner Tasks
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => refresh()}
                disabled={isRefreshing}
              >
                <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                <span className="sr-only">Refresh tasks</span>
              </Button>
            )}
            {tasks.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs px-2"
                onClick={() => window.open('https://tasks.office.com', '_blank')}
              >
                Open Planner
                <ChevronRight className="ml-1 h-2 w-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks assigned</p>
          ) : (
            <>
              {/* Active Tasks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium">Active Tasks</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {activeTasks.length} tasks
                  </span>
                </div>
                <div className="space-y-1">
                  {displayActiveTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
                {activeTasks.length > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs h-6"
                    onClick={() => setShowAllActive(!showAllActive)}
                  >
                    {showAllActive ? 'Show Less' : `Show ${activeTasks.length - 3} More`}
                  </Button>
                )}
              </div>

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium">Completed</h3>
                    <span className="text-[10px] text-muted-foreground">
                      {completedTasks.length} tasks
                    </span>
                  </div>
                  <div className="space-y-1">
                    {displayCompletedTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                  {completedTasks.length > 2 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs h-6"
                      onClick={() => setShowAllCompleted(!showAllCompleted)}
                    >
                      {showAllCompleted ? 'Show Less' : `Show ${completedTasks.length - 2} More`}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 