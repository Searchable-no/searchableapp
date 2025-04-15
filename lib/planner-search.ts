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

interface SearchHit {
  resource: PlannerTaskDetails;
  score?: number;
}

export async function searchPlannerTasks(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);

    // Use the search endpoint for planner tasks
    const searchResponse = await graphClient
      .api('/search/query')
      .post({
        requests: [{
          entityTypes: ['plannerTask'],
          query: {
            queryString: query,
          },
          from: 0,
          size: 25,
          fields: [
            'id',
            'title',
            'createdDateTime',
            'dueDateTime',
            'priority',
            'percentComplete',
            'description',
            'createdBy',
            'lastModifiedDateTime',
            'lastModifiedBy'
          ]
        }]
      });

    if (!searchResponse?.value?.[0]?.hitsContainers?.[0]?.hits) {
      // Fallback to traditional planner task API if search doesn't return results
      return fallbackPlannerSearch(graphClient, query);
    }

    const hits = searchResponse.value[0].hitsContainers[0].hits;

    // Process search results
    const results = hits
      .map((hit: SearchHit) => {
        const task = hit.resource;
        if (!task) return null;

        // Use Microsoft's built-in relevance scoring directly
        const score = hit.score || 0;

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
      .filter((task: SearchResult | null): task is SearchResult => task !== null)
      .sort((a: SearchResult, b: SearchResult) => (b.score || 0) - (a.score || 0));

    return results;
  } catch (error) {
    console.error('Error searching planner tasks with Search API:', error);
    // If Search API fails, fall back to the traditional method
    try {
      const graphClient = await getGraphClient(await getValidAccessToken(userId));
      return fallbackPlannerSearch(graphClient, query);
    } catch (fallbackError) {
      console.error('Fallback planner search also failed:', fallbackError);
      return [];
    }
  }
}

// Fallback function using the previous implementation
async function fallbackPlannerSearch(graphClient: any, query: string): Promise<SearchResult[]> {
  try {
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

    // Filter tasks that match the query
    const lowerQuery = query.toLowerCase();
    const matchingTasks = tasksWithDetails
      .filter((task: PlannerTaskDetails) => 
        task.title.toLowerCase().includes(lowerQuery) || 
        (task.details?.description || '').toLowerCase().includes(lowerQuery)
      )
      .map((task: PlannerTaskDetails) => ({
        id: task.id,
        name: task.title,
        webUrl: `https://tasks.office.com/searchable.no/Home/Task/${task.id}`,
        lastModifiedDateTime: task.details?.lastModifiedDateTime || task.createdDateTime,
        type: 'planner' as const,
        preview: task.details?.description || '',
        score: 1, // Basic score for fallback results
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
      }));

    return matchingTasks;
  } catch (error) {
    console.error('Error in fallback planner search:', error);
    return [];
  }
} 