import { getGraphClient } from './microsoft-graph';
import { SearchResult } from './microsoft-graph';
import { getValidAccessToken } from './server-actions';

interface SearchHit {
  resource: {
    id: string;
    subject: string;
    webLink: string;
    receivedDateTime: string;
    from?: {
      emailAddress?: {
        name?: string;
        address?: string;
      }
    };
    body?: {
      content?: string;
    };
    importance?: 'low' | 'normal' | 'high';
    hasAttachments?: boolean;
  };
  score?: number;
}

export async function searchEmails(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);

    // Use the search endpoint instead of filtering
    const searchResponse = await graphClient
      .api('/search/query')
      .post({
        requests: [{
          entityTypes: ['message'],
          query: {
            queryString: query,
          },
          from: 0,
          size: 25,
          fields: [
            'id',
            'subject',
            'webLink',
            'receivedDateTime',
            'from',
            'body',
            'importance',
            'hasAttachments'
          ]
        }]
      });

    if (!searchResponse?.value?.[0]?.hitsContainers?.[0]?.hits) {
      return [];
    }

    const hits = searchResponse.value[0].hitsContainers[0].hits;
    const lowerQuery = query.toLowerCase();

    return hits
      .map((hit: SearchHit) => {
        const email = hit.resource;
        if (!email) return null;

        // Calculate relevance score
        let score = hit.score || 0; // Use the search score as a base
        const subject = email.subject?.toLowerCase() || '';
        const body = email.body?.content?.toLowerCase() || '';
        const fromAddress = email.from?.emailAddress?.address?.toLowerCase() || '';
        const fromName = email.from?.emailAddress?.name?.toLowerCase() || '';

        // Boost score based on exact matches
        if (subject === lowerQuery) score += 100;
        else if (subject.includes(lowerQuery)) score += 50;
        if (fromAddress.includes(lowerQuery)) score += 30;
        if (fromName.includes(lowerQuery)) score += 30;
        if (body?.includes(lowerQuery)) score += 20;
        if (email.importance === 'high') score += 25;
        if (email.hasAttachments && lowerQuery.includes('attachment')) score += 25;

        return {
          id: email.id,
          name: email.subject || 'No Subject',
          webUrl: email.webLink,
          lastModifiedDateTime: email.receivedDateTime,
          type: 'email' as const,
          preview: email.body?.content || '',
          score,
          from: {
            name: email.from?.emailAddress?.name || 'Unknown',
            email: email.from?.emailAddress?.address || ''
          },
          createdBy: {
            user: {
              displayName: email.from?.emailAddress?.name || 'Unknown'
            }
          },
          lastModifiedBy: {
            user: {
              displayName: email.from?.emailAddress?.name || 'Unknown'
            }
          }
        };
      })
      .filter((result: SearchResult | null): result is SearchResult => result !== null)
      .sort((a: SearchResult, b: SearchResult) => (b.score ?? 0) - (a.score ?? 0));
  } catch (error) {
    console.error('Error searching emails:', error);
    return [];
  }
} 