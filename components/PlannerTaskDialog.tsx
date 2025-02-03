'use client'

import { useState, useEffect } from 'react'
import { PlannerTask, PlannerTaskComment } from '@/lib/microsoft-graph'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  ExternalLink, 
  Calendar, 
  ListTodo, 
  Users, 
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart2,
  MessageSquare,
  Square,
  CheckSquare,
} from 'lucide-react'
import { formatDate, formatDistanceToNow } from '@/lib/utils'
import { updatePlannerTask, getTaskComments, addTaskComment } from '@/app/dashboard/actions'
import { useToast } from '@/components/ui/use-toast'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface PlannerTaskDialogProps {
  task: PlannerTask
  children: React.ReactNode
  userId: string
  onTaskUpdate?: () => void
}

interface UpdatePlannerTaskResponse {
  success: boolean
  error?: {
    message: string
    details: any
  }
}

export function PlannerTaskDialog({ task, children, userId, onTaskUpdate }: PlannerTaskDialogProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [percentComplete, setPercentComplete] = useState(task.percentComplete)
  const [priority, setPriority] = useState(task.priority.toString())
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDateTime ? new Date(task.dueDateTime) : undefined
  )
  const [notes, setNotes] = useState(task.description || '')
  const [isOpen, setIsOpen] = useState(false)
  const [comments, setComments] = useState<PlannerTaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  const assignees = Object.values(task.assignments).map(
    (assignment) => assignment.assignedBy.user.displayName
  )

  const handleUpdateTask = async (updates: {
    percentComplete?: number
    priority?: number
    dueDateTime?: string | null
    description?: string
  }): Promise<UpdatePlannerTaskResponse> => {
    try {
      console.log('Updating task with user ID:', userId)
      const result = await updatePlannerTask(userId, task.id, updates)
      if (result.success) {
        onTaskUpdate?.()
        toast({
          title: 'Task updated',
          description: 'The task has been updated successfully.',
        })
      }
      return result
    } catch (error: any) {
      console.error('Error in handleUpdateTask:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      })
      return {
        success: false,
        error: {
          message: error.message || 'Failed to update task',
          details: error
        }
      }
    }
  }

  const getPriorityColor = (priorityValue: number) => {
    switch (priorityValue) {
      case 9:
        return 'text-red-500'
      case 5:
        return 'text-orange-500'
      case 3:
        return 'text-yellow-500'
      case 1:
        return 'text-blue-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBadge = () => {
    if (percentComplete === 100) {
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>
    }
    if (dueDate && new Date(dueDate) < new Date()) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Overdue</Badge>
    }
    if (percentComplete > 0) {
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> In Progress</Badge>
    }
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Not Started</Badge>
  }

  // Quick complete/uncomplete handler
  const handleQuickComplete = async () => {
    const newPercentComplete = percentComplete === 100 ? 0 : 100
    setIsUpdating(true)
    try {
      const result = await handleUpdateTask({
        percentComplete: newPercentComplete
      })
      if (result.success) {
        setPercentComplete(newPercentComplete)
        toast({
          title: newPercentComplete === 100 ? 'Task completed' : 'Task reopened',
          description: `Task "${task.title}" has been ${newPercentComplete === 100 ? 'marked as complete' : 'reopened'}.`,
        })
      } else {
        throw new Error(result.error?.message || 'Failed to update task')
      }
    } catch (error: any) {
      console.error('Failed to quick complete task:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task completion status.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Load comments when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadComments()
    }
  }, [isOpen])

  const loadComments = async () => {
    setIsLoadingComments(true)
    try {
      const taskComments = await getTaskComments(userId, task.id)
      setComments(taskComments)
    } catch (error) {
      console.error('Failed to load comments:', error)
      toast({
        title: 'Error',
        description: 'Failed to load task comments.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    
    setIsUpdating(true)
    try {
      const success = await addTaskComment(userId, task.id, newComment)
      if (success) {
        setNewComment('')
        await loadComments() // Reload comments after adding new one
        toast({
          title: 'Comment added',
          description: 'Your comment has been added successfully.',
        })
      } else {
        throw new Error('Failed to add comment')
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={handleQuickComplete}
                disabled={isUpdating}
                className="hover:bg-accent p-1 rounded-md transition-colors"
                title={percentComplete === 100 ? "Mark as incomplete" : "Mark as complete"}
              >
                {isUpdating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : percentComplete === 100 ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>
              <DialogTitle className="pr-8">{task.title}</DialogTitle>
            </div>
            {getStatusBadge()}
          </div>
          <DialogDescription className="flex items-center gap-2">
            Created {formatDistanceToNow(new Date(task.createdDateTime))} ago
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Plan Info */}
          <div className="grid grid-cols-[20px_1fr] items-start gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium mb-1">Plan</div>
              <div className="text-sm text-muted-foreground">{task.planTitle}</div>
            </div>
          </div>

          {/* Due Date */}
          <div className="grid grid-cols-[20px_1fr] items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium mb-1">Due Date</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] pl-3 text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    {dueDate ? (
                      <span className={cn(
                        "flex items-center",
                        new Date(dueDate) < new Date() && "text-red-500"
                      )}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {formatDate(dueDate.toISOString())}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        Set due date
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="text-sm font-medium">Due Date</div>
                    <div className="text-sm text-muted-foreground">
                      Select a date for this task
                    </div>
                  </div>
                  <CalendarPicker
                    mode="single"
                    selected={dueDate}
                    onSelect={async (date) => {
                      if (!date) return
                      try {
                        setIsUpdating(true)
                        setDueDate(date)
                        const result = await handleUpdateTask({
                          dueDateTime: date.toISOString(),
                        })
                        if (!result.success) {
                          throw new Error(result.error?.message)
                        }
                      } catch (error) {
                        console.error('Failed to update due date:', error)
                        toast({
                          title: 'Error',
                          description: 'Failed to update the due date. Please try again.',
                          variant: 'destructive',
                        })
                        // Reset the date if update failed
                        setDueDate(dueDate)
                      } finally {
                        setIsUpdating(false)
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-3"
                    initialFocus={false}
                    fromDate={new Date()}
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                      day_range_end: "day-range-end",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "opacity-50",
                      day_disabled: "opacity-50",
                      day_hidden: "invisible",
                    }}
                  />
                  {dueDate && (
                    <div className="p-3 border-t">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setDueDate(undefined)
                          handleUpdateTask({ dueDateTime: null })
                        }}
                      >
                        <span className="flex items-center">
                          Clear date
                        </span>
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {dueDate && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDistanceToNow(dueDate)} {new Date(dueDate) < new Date() ? 'overdue' : 'remaining'}
                </div>
              )}
            </div>
          </div>

          {/* Assignees */}
          {assignees.length > 0 && (
            <div className="grid grid-cols-[20px_1fr] items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium mb-1">Assigned To</div>
                <div className="flex flex-wrap gap-2">
                  {assignees.map((assignee, index) => (
                    <Badge key={index} variant="secondary">
                      {assignee}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="grid grid-cols-[20px_1fr] items-start gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium mb-1">Progress</div>
              <div className="space-y-2">
                <Slider
                  value={[percentComplete]}
                  onValueChange={(value: number[]) => setPercentComplete(value[0])}
                  onValueCommit={(value: number[]) => {
                    handleUpdateTask({ percentComplete: value[0] })
                  }}
                  max={100}
                  step={25}
                  className={cn(
                    percentComplete === 100 && "text-green-500",
                    percentComplete > 0 && percentComplete < 100 && "text-blue-500"
                  )}
                />
                <div className="text-sm text-muted-foreground">
                  {percentComplete}% Complete
                </div>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-[20px_1fr] items-start gap-2">
            <AlertCircle className={cn("h-4 w-4 mt-0.5", getPriorityColor(parseInt(priority)))} />
            <div>
              <div className="font-medium mb-1">Priority</div>
              <Select
                value={priority}
                onValueChange={(value) => {
                  setPriority(value)
                  handleUpdateTask({ priority: parseInt(value) })
                }}
              >
                <SelectTrigger className={cn("w-full", getPriorityColor(parseInt(priority)))}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No priority</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="3">Medium</SelectItem>
                  <SelectItem value="5">High</SelectItem>
                  <SelectItem value="9">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="font-medium">Notes</label>
            <Textarea
              placeholder="Add notes about this task..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => handleUpdateTask({ description: notes })}
              className="min-h-[100px]"
            />
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-4 mt-6 pt-6 border-t">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Comments</h3>
          </div>
          
          <div className="space-y-4">
            {isLoadingComments ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-muted p-3 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{comment.user.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdDateTime))} ago
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments yet
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAddComment}
              disabled={isUpdating || !newComment.trim()}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => window.open(task.webUrl, '_blank')}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                Open in Planner
                <ExternalLink className="h-3 w-3" />
              </>
            )}
          </Button>
          <Button 
            variant="default"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 