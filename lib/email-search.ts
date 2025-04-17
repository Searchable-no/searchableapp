import { getGraphClient } from './microsoft-graph';
import { SearchResult } from './microsoft-graph';
import { getValidAccessToken } from './server-actions';

interface SearchHit {
  resource: {
    id?: string;
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

// Function to extract ID from webLink if id is missing
function extractIdFromWebLink(webLink: string): string {
  try {
    // Extract ItemID parameter from the URL
    const url = new URL(webLink);
    const itemIdParam = url.searchParams.get('ItemID');
    if (itemIdParam) {
      return itemIdParam;
    }
    
    // If no ItemID in params, use the last part of the URL path
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    return lastPart || webLink; // Use the webLink itself as last resort
  } catch (e) {
    // If parsing fails, just return the webLink as an ID
    return webLink;
  }
}

export async function searchEmails(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);

    console.log(`Email search: searching for "${query}" for user ${userId}`);

    // Try both approaches - first the search API, then fallback to direct query
    let emailResults: any[] = [];
    
    try {
      // First try using the search endpoint
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
  
      // Log the entire search response structure for debugging
      console.log('Raw search response structure:', JSON.stringify(searchResponse, null, 2));
      
      if (searchResponse?.value?.[0]?.hitsContainers?.[0]?.hits) {
        const hits = searchResponse.value[0].hitsContainers[0].hits;
        console.log(`Email search API: Found ${hits.length} hits`);
        
        if (hits.length > 0) {
          console.log('Email search API: Full hit structure:', JSON.stringify(hits[0], null, 2));
          const resource = hits[0].resource;
          // More detailed logging
          console.log('Complete resource object:', JSON.stringify(resource, null, 2));
        }
        
        emailResults = hits.map((hit: SearchHit) => hit.resource);
      } else {
        console.log('Email search API: No hits found in response, structure:', JSON.stringify(searchResponse, null, 2));
      }
    } catch (searchError) {
      console.error('Email search API failed:', searchError);
    }
    
    // If search API returned no results, use the direct query approach
    if (emailResults.length === 0) {
      console.log('Email search: Falling back to direct query');
      try {
        // Filter emails directly using the /messages endpoint
        const response = await graphClient.api("/me/messages")
          .filter(`contains(subject,'${query}') or contains(bodyPreview,'${query}')`)
          .top(25)
          .orderby("receivedDateTime desc")
          .select("id,subject,receivedDateTime,from,bodyPreview,webLink")
          .get();
          
        console.log('Direct query raw response:', JSON.stringify(response, null, 2));
          
        if (response?.value) {
          emailResults = response.value;
          console.log(`Email direct query: Found ${emailResults.length} emails`);
          
          if (emailResults.length > 0) {
            console.log('Email direct query: Full email object:', JSON.stringify(emailResults[0], null, 2));
          }
        }
      } catch (directQueryError) {
        console.error('Email direct query failed:', directQueryError);
      }
    }
    
    if (emailResults.length === 0) {
      console.log('Email search: No results found with either approach');
      return [];
    }

    // Process results with more robust extraction
    const results = emailResults
      .filter((email): email is any => email !== null)
      .map((email, index) => {
        console.log(`Processing email ${index}:`, JSON.stringify(email, null, 2));

        // More robust subject extraction
        let subject = 'No Subject';
        if (email.subject && typeof email.subject === 'string') {
          subject = email.subject;
        } else if (email.Subject && typeof email.Subject === 'string') {
          subject = email.Subject;
        }

        // More robust from extraction
        let fromName = 'Unknown';
        let fromEmail = '';
        
        // Log all top-level keys in the email object
        console.log(`Email ${index} keys:`, Object.keys(email));
        
        // Try multiple approaches to extract from information
        if (email.from) {
          console.log(`Email ${index} from field:`, JSON.stringify(email.from, null, 2));
          
          // Try direct approach first
          if (typeof email.from === 'object') {
            // Check if it's using the Microsoft Graph format
            if (email.from.emailAddress) {
              fromName = email.from.emailAddress.name || 'Unknown';
              fromEmail = email.from.emailAddress.address || '';
            } 
            // Check if it's directly on the from object
            else if (email.from.name) {
              fromName = email.from.name;
              fromEmail = email.from.address || '';
            }
            // Check if it's an array
            else if (Array.isArray(email.from) && email.from.length > 0) {
              const sender = email.from[0];
              if (sender.emailAddress) {
                fromName = sender.emailAddress.name || 'Unknown';
                fromEmail = sender.emailAddress.address || '';
              } else if (sender.name) {
                fromName = sender.name;
                fromEmail = sender.address || '';
              }
            }
          } else if (typeof email.from === 'string') {
            // Handle case where from might be a string
            fromName = email.from;
          }
        }
        // Try alternative field names
        else if (email.sender) {
          console.log(`Email ${index} sender field:`, JSON.stringify(email.sender, null, 2));
          if (typeof email.sender === 'object') {
            if (email.sender.emailAddress) {
              fromName = email.sender.emailAddress.name || 'Unknown';
              fromEmail = email.sender.emailAddress.address || '';
            } else if (email.sender.name) {
              fromName = email.sender.name;
              fromEmail = email.sender.address || '';
            }
          }
        }
        
        // Generate a reliable ID
        let emailId: string;
        if (email.id) {
          emailId = email.id;
        } else if (email.webLink) {
          emailId = extractIdFromWebLink(email.webLink);
        } else if (email.conversationId) {
          emailId = `conv-${email.conversationId}`;
        } else {
          // Fallback with timestamp and a random component
          emailId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        }

        // Use receivedDateTime or createdDateTime or any other timestamp
        let timestamp = email.receivedDateTime || email.createdDateTime || email.sentDateTime || new Date().toISOString();

        // Generate preview from bodyPreview or body content
        let preview = '';
        if (email.bodyPreview) {
          preview = email.bodyPreview;
        } else if (email.body && email.body.content) {
          // Strip HTML tags if present
          preview = email.body.content.replace(/<[^>]*>/g, '').substring(0, 200);
        }

        // Create the result with all extracted fields
        const result: SearchResult = {
          id: emailId,
          name: subject,
          webUrl: email.webLink || '',
          lastModifiedDateTime: timestamp,
          type: 'email' as const,
          preview: preview,
          score: 1,
          from: {
            name: fromName,
            email: fromEmail
          },
          createdBy: {
            user: {
              displayName: fromName
            }
          },
          lastModifiedBy: {
            user: {
              displayName: fromName
            }
          }
        };

        console.log('Email search: Final processed result:', {
          id: result.id,
          name: result.name,
          from: result.from
        });

        return result;
      });

    return results.sort((a, b) => 
      new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
    );
  } catch (error) {
    console.error('Error searching emails:', error);
    return [];
  }
} 