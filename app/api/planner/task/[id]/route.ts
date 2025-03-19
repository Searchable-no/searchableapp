import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getGraphClient } from '@/lib/microsoft-graph';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;
  
  console.log(`API request received for task ID: ${taskId}`);
  
  if (!taskId) {
    console.error('Task ID is missing in request');
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    );
  }
  
  const supabase = createServerComponentClient({ cookies });
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user?.email) {
    console.error('Authentication error:', userError);
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  console.log(`Processing task request for user: ${user.email}`);
  
  // Get user ID from database
  const { data: userData, error: userDbError } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .single();
  
  if (userDbError || !userData) {
    console.error('User not found in database:', userDbError);
    return NextResponse.json(
      { error: 'User not found in database' },
      { status: 404 }
    );
  }
  
  // Check if user has Microsoft connection
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('access_token')
    .eq('user_id', userData.id)
    .eq('provider', 'microsoft')
    .single();
  
  if (connectionError || !connection) {
    console.error('Microsoft connection not found:', connectionError);
    return NextResponse.json(
      { error: 'Microsoft account not connected' },
      { status: 400 }
    );
  }
  
  try {
    const graphClient = await getGraphClient(connection.access_token);
    
    console.log(`Fetching task details for ID: ${taskId}`);
    
    // Get task details
    let task;
    try {
      task = await graphClient
        .api(`/planner/tasks/${taskId}`)
        .get();
      
      console.log(`Task retrieved from Graph API:`, { id: task.id, title: task.title });
    } catch (error: any) {
      console.error(`Error retrieving task:`, error);
      return NextResponse.json(
        { error: `Task not found: ${error.message || 'Unknown error'}` },
        { status: error.statusCode || 404 }
      );
    }
    
    if (!task || !task.id) {
      console.error('Task not found or returned empty');
      return NextResponse.json(
        { error: 'Task not found or returned invalid data' },
        { status: 404 }
      );
    }
    
    // Get task details (description)
    let taskDetailsResponse = null;
    let description = '';
    try {
      taskDetailsResponse = await graphClient
        .api(`/planner/tasks/${taskId}/details`)
        .get();
      console.log(`Task details retrieved successfully`);
      description = taskDetailsResponse?.description || '';
    } catch (error) {
      console.warn(`Could not retrieve task details:`, error);
      // Continue with empty description
    }
    
    // Get plan details to include the plan title
    let planTitle = 'Unknown Plan';
    if (task.planId) {
      try {
        const plan = await graphClient
          .api(`/planner/plans/${task.planId}`)
          .get();
        
        planTitle = plan.title || 'Unknown Plan';
        console.log(`Retrieved plan title: ${planTitle}`);
      } catch (error) {
        console.warn(`Could not retrieve plan details:`, error);
        // Continue with default plan title
      }
    }
    
    // Get bucket details to include the bucket name
    let bucketName = 'Unknown Bucket';
    if (task.bucketId) {
      try {
        const bucket = await graphClient
          .api(`/planner/buckets/${task.bucketId}`)
          .get();
        
        bucketName = bucket.name || 'Unknown Bucket';
        console.log(`Retrieved bucket name: ${bucketName}`);
      } catch (error) {
        console.warn(`Could not retrieve bucket details:`, error);
        // Continue with default bucket name
      }
    }
    
    // Set task type for consistency with the PlannerTask interface
    task.type = 'planner';
    
    // Create a valid web URL for the task
    const webUrl = task.webUrl || `https://tasks.office.com/task/edit/${task.id}`;
    
    // Format task for client consumption
    const formattedTask = {
      id: task.id,
      title: task.title || 'Untitled Task',
      dueDateTime: task.dueDateTime || null,
      createdDateTime: task.createdDateTime || new Date().toISOString(),
      assignedUserIds: task.assignments ? Object.keys(task.assignments) : [],
      planId: task.planId || '',
      planTitle: planTitle,
      bucketId: task.bucketId || '',
      bucketName: bucketName,
      percentComplete: typeof task.percentComplete === 'number' ? task.percentComplete : 0,
      priority: typeof task.priority === 'number' ? task.priority : 1,
      description: description,
      type: 'planner',
      webUrl: webUrl
    };
    
    console.log(`Returning formatted task:`, { 
      id: formattedTask.id, 
      title: formattedTask.title, 
      percentComplete: formattedTask.percentComplete,
      hasDescription: !!formattedTask.description
    });
    
    return NextResponse.json({ task: formattedTask });
  } catch (error: any) {
    console.error('Error in planner task API:', error);
    
    // Detailed error logging for debugging
    console.error({
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body ? JSON.stringify(error.body, null, 2) : undefined,
      stack: error.stack
    });
    
    // Handle Microsoft Graph API errors
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    
    return NextResponse.json(
      { 
        error: message,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          body: error.body
        } : undefined
      },
      { status }
    );
  }
} 