import { getGraphClient } from './microsoft-graph';
import { SearchResult } from './microsoft-graph';
import { getValidAccessToken } from './server-actions';

interface PlannerTaskDetails {
  id: string;
  title: string;
  createdDateTime: string;
  dueDateTime?: string;
  priority: number;
  percentComplete: number;
  description?: string;
  details?: {
    description?: string;
    lastModifiedDateTime?: string;
    lastModifiedBy?: {
      user?: {
        displayName?: string;
      }
    }
  }
  createdBy?: {
    user?: {
      displayName?: string;
    }
  }
}

export async function searchPlannerTasks(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);

    // Get all tasks first since Planner API doesn't support full text search
    const plannerResponse = await graphClient
      .api('/me/planner/tasks')
      .select('id,title,createdDateTime,dueDateTime,priority,percentComplete,createdBy')
      .get();

    if (!plannerResponse?.value) {
      return [];
    }

    // Get details for each task
    const tasksWithDetails = await Promise.all(
      plannerResponse.value.map(async (task: PlannerTaskDetails) => {
        try {
          const details = await graphClient
            .api(`/planner/tasks/${task.id}/details`)
            .get();
          return { ...task, details };
        } catch (error) {
          console.error(`Error fetching details for task ${task.id}:`, error);
          return task;
        }
      })
    );

    // Calculate relevance scores and filter tasks
    const scoredTasks = tasksWithDetails
      .map(task => {
        // Search in title and description
        const lowerQuery = query.toLowerCase();
        const titleWords = task.title.toLowerCase().split(/\s+/);
        const descriptionWords = (task.details?.description || '').toLowerCase().split(/\s+/);
        
        // Check for word matches instead of exact string matches
        const titleMatches = titleWords.filter(word => word.includes(lowerQuery) || lowerQuery.includes(word));
        const descriptionMatches = descriptionWords.filter(word => word.includes(lowerQuery) || lowerQuery.includes(word));
        
        if (titleMatches.length === 0 && descriptionMatches.length === 0) {
          return null;
        }

        // Calculate base score from matches
        let score = 0;
        
        // Title matches (up to 100 points)
        score += titleMatches.length * 25;
        
        // Description matches (up to 50 points)
        score += descriptionMatches.length * 10;

        // Boost score based on various factors
        const now = new Date().getTime();
        
        // Recency boost (higher score for newer tasks)
        const ageInDays = (now - new Date(task.createdDateTime).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - ageInDays); // Boost newer tasks, max 30 points

        // Priority boost
        score += (task.priority || 0) * 10; // 0-90 points based on priority

        // Due date boost (boost tasks due soon)
        if (task.dueDateTime) {
          const daysUntilDue = (new Date(task.dueDateTime).getTime() - now) / (1000 * 60 * 60 * 24);
          if (daysUntilDue > 0 && daysUntilDue < 7) {
            score += Math.max(0, 70 - (daysUntilDue * 10)); // Up to 70 points for tasks due very soon
          }
        }

        // Completion status penalty
        score -= task.percentComplete; // Lower score for tasks that are more complete

        return {
          id: task.id,
          name: task.title,
          webUrl: `https://tasks.office.com/searchable.no/Home/Task/${task.id}`,
          lastModifiedDateTime: task.details?.lastModifiedDateTime || task.createdDateTime,
          type: 'planner' as const,
          preview: task.details?.description || '',
          score,
          createdBy: {
            user: {
              displayName: task.createdBy?.user?.displayName || 'Unknown'
            }
          },
          lastModifiedBy: {
            user: {
              displayName: task.details?.lastModifiedBy?.user?.displayName || task.createdBy?.user?.displayName || 'Unknown'
            }
          }
        };
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .sort((a, b) => b.score - a.score);

    return scoredTasks;
  } catch (error) {
    console.error('Error searching planner tasks:', error);
    return [];
  }
} 