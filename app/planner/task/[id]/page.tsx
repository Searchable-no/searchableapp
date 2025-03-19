"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Calendar, 
  Loader2, 
  ListTodo, 
  Users, 
  ExternalLink
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/hooks";
import { PlannerTask, getTaskComments, addTaskComment } from "@/lib/microsoft-graph";
import { updatePlannerTask } from "@/app/dashboard/actions";
import { toast } from "sonner";

export default function PlannerTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { user, loading: userLoading } = useUser();
  
  const [task, setTask] = useState<PlannerTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [description, setDescription] = useState("");
  const [percentComplete, setPercentComplete] = useState(0);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState(1);
  
  useEffect(() => {
    const fetchTaskDetails = async () => {
      if (userLoading || !user?.id) return;
      
      try {
        setLoading(true);
        // Fetch the task from Microsoft Graph API
        console.log(`Fetching task details for task ID: ${taskId}`);
        const response = await fetch(`/api/planner/task/${taskId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Task fetch response error:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to fetch task details');
        }
        
        const data = await response.json();
        console.log('Task data received:', data);
        
        if (!data.task) {
          console.error('No task data in response');
          throw new Error('Task data not found in response');
        }
        
        setTask(data.task);
        
        // Initialize form fields
        if (data.task) {
          setDescription(data.task.description || "");
          setPercentComplete(data.task.percentComplete || 0);
          setPriority(data.task.priority || 1);
          setDueDate(data.task.dueDateTime ? new Date(data.task.dueDateTime) : undefined);
        }
        
        // Fetch comments
        fetchComments();
      } catch (error) {
        console.error('Error fetching task details:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load task details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTaskDetails();
  }, [taskId, user?.id, userLoading]);
  
  const fetchComments = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingComments(true);
      console.log(`Fetching comments for task ID: ${taskId}`);
      const commentsData = await getTaskComments(user.id, taskId);
      console.log(`Retrieved ${commentsData.length} comments`);
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handleSaveTask = async () => {
    if (!user?.id || !task) return;
    
    try {
      setSaving(true);
      console.log(`Updating task ${taskId} with:`, {
        percentComplete,
        priority,
        dueDateTime: dueDate ? dueDate.toISOString() : null,
        description: description ? `${description.slice(0, 30)}...` : 'Empty'
      });
      
      const result = await updatePlannerTask(
        user.id,
        taskId,
        {
          percentComplete,
          priority,
          dueDateTime: dueDate ? dueDate.toISOString() : null,
          description
        }
      );
      
      if (result.success) {
        console.log('Task update successful');
        toast.success('Task updated successfully');
        // Update local task state
        setTask({
          ...task,
          percentComplete,
          priority,
          dueDateTime: dueDate ? dueDate.toISOString() : null,
          description
        });
      } else {
        console.error('Failed to update task:', result.error);
        if (result.error?.message?.includes('etag') || result.error?.message?.includes('match')) {
          // Handle etag error - task may have been modified by someone else
          toast.error('This task was modified by someone else. Refreshing latest version...');
          // Refetch the task to get the latest version
          window.location.reload();
        } else {
          toast.error('Failed to update task: ' + (result.error?.message || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddComment = async () => {
    if (!user?.id || !newComment.trim()) return;
    
    try {
      const success = await addTaskComment(user.id, taskId, newComment);
      if (success) {
        toast.success('Comment added');
        setNewComment("");
        fetchComments(); // Refresh comments
      } else {
        toast.error('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment. Please try again.');
    }
  };
  
  // Function to handle retry when task loading fails
  const handleRetryLoading = () => {
    setLoading(true);
    window.location.reload();
  };
  
  if (userLoading || loading) {
    return (
      <div className="container max-w-5xl mx-auto px-3 py-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (!task) {
    return (
      <div className="container max-w-5xl mx-auto px-3 py-4">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ListTodo className="h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="text-lg font-medium mb-2">Task not found</h2>
          <p className="text-sm text-muted-foreground mb-3">The requested task could not be found or you don't have permission to view it.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              Go Back
            </Button>
            <Button variant="default" size="sm" onClick={handleRetryLoading}>
              <Loader2 className="mr-2 h-3.5 w-3.5" />
              Retry Loading
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-5xl mx-auto px-3 py-4">
      <Button 
        variant="outline" 
        size="sm" 
        className="mb-3 h-7 text-xs"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Dashboard
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base flex items-start justify-between gap-2">
                <div className="flex-1">{task.title}</div>
                {task.webUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => window.open(task.webUrl, '_blank')}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open in Planner
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {task.planTitle && (
                  <div className="flex items-center gap-1.5">
                    <span>Plan: {task.planTitle}</span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Description</label>
                <Textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[80px] text-xs"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium mb-1 block">Progress ({percentComplete}%)</label>
                <Slider
                  value={[percentComplete]}
                  max={100}
                  step={5}
                  onValueChange={(value) => setPercentComplete(value[0])}
                  className="py-3"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">Due Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 text-xs",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {dueDate ? format(dueDate, "PPP") : "No due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                      {dueDate && (
                        <div className="p-2 border-t border-border">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs h-7"
                            onClick={() => setDueDate(undefined)}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="w-full sm:w-28">
                  <label className="text-xs font-medium mb-1 block">Priority</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0 px-3 pb-3">
              <Button 
                className="ml-auto h-7 text-xs" 
                onClick={handleSaveTask} 
                disabled={saving}
              >
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-3">
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2 pb-2 border-b border-border">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-xs font-medium">{comment.user?.displayName || 'Unknown User'}</h4>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.createdDateTime).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-4">No comments yet</p>
              )}
              
              <div className="mt-3">
                <Textarea 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="mb-2 text-xs min-h-[60px]"
                />
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto h-7 text-xs"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Add Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div>
                <h4 className="text-[10px] font-medium text-muted-foreground">Created</h4>
                <p className="text-xs">{new Date(task.createdDateTime).toLocaleDateString()}</p>
              </div>
              
              {task.bucketName && (
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground">Bucket</h4>
                  <p className="text-xs">{task.bucketName}</p>
                </div>
              )}
              
              {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground">Assigned To</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.assignedUserIds.map((userId, index) => (
                      <div
                        key={userId}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]"
                      >
                        <Users className="h-2.5 w-2.5 mr-1" />
                        <span>User {index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-in-out"
                    style={{ width: `${task.percentComplete}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-muted-foreground">Progress</span>
                  <span className="text-[10px] font-medium">{task.percentComplete}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 