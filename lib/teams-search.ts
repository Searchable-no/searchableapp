import { getGraphClient } from './microsoft-graph';
import { SearchResult } from './microsoft-graph';
import { getValidAccessToken } from './server-actions';

interface TeamsMessage {
  id: string;
  messageType?: string;
  body?: {
    content?: string;
  };
  from?: {
    user?: {
      displayName?: string;
    }
  };
  webUrl?: string;
  lastModifiedDateTime?: string;
  createdDateTime: string;
}

interface ChatMessage extends TeamsMessage {
  topic?: string;
}

interface SearchHit {
  resource: TeamsMessage;
  score?: number;
}

export async function searchTeamsMessages(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
    
    // If this is a wildcard search, use traditional method
    if (query === '*') {
      return traditionalTeamsSearch(graphClient, query);
    }
    
    // Use the Microsoft Search API to search chat and channel messages
    const searchResponse = await graphClient
      .api('/search/query')
      .post({
        requests: [{
          entityTypes: ['chatMessage'],
          query: {
            queryString: query,
          },
          from: 0,
          size: 50,
          fields: [
            'id',
            'body',
            'from',
            'createdDateTime',
            'lastModifiedDateTime',
            'webUrl',
            'channelIdentity',
            'chatId'
          ]
        }]
      });

    if (!searchResponse?.value?.[0]?.hitsContainers?.[0]?.hits) {
      // If search returns no results, fall back to traditional method
      return traditionalTeamsSearch(graphClient, query);
    }

    const hits = searchResponse.value[0].hitsContainers[0].hits;
    const results: SearchResult[] = [];

    // Process the search results
    for (const hit of hits) {
      try {
        const message = hit.resource;
        if (!message) continue;
        
        // Calculate cleaned content
        const messageContent = message.body?.content || '';
        const cleanContent = messageContent
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        // Use Microsoft's built-in relevance scoring directly
        const score = hit.score || 0;
        
        // Determine if this is a chat or channel message and get extra metadata
        let messageType: 'chat' | 'channel' = 'chat';
        let teamName = 'Chat';
        let channelName = 'Direct Message';
        
        // Get team and channel info if available
        if (message.channelIdentity) {
          messageType = 'channel';
          
          // Try to get team and channel names
          try {
            const team = await graphClient
              .api(`/teams/${message.channelIdentity.teamId}`)
              .get();
              
            const channel = await graphClient
              .api(`/teams/${message.channelIdentity.teamId}/channels/${message.channelIdentity.channelId}`)
              .get();
              
            teamName = team.displayName || 'Unknown Team';
            channelName = channel.displayName || 'Unknown Channel';
          } catch (error) {
            console.error('Error getting team/channel details:', error);
          }
        } else if (message.chatId) {
          try {
            const chat = await graphClient
              .api(`/me/chats/${message.chatId}`)
              .get();
            
            channelName = chat.topic || 'Direct Message';
          } catch (error) {
            console.error('Error getting chat details:', error);
          }
        }
        
        results.push({
          id: message.id,
          name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
          webUrl: message.webUrl || '',
          lastModifiedDateTime: message.lastModifiedDateTime || message.createdDateTime,
          type: messageType,
          preview: cleanContent,
          score,
          from: {
            name: message.from?.user?.displayName || 'Unknown'
          },
          location: {
            team: teamName,
            channel: channelName
          },
          createdBy: {
            user: {
              displayName: message.from?.user?.displayName || 'Unknown'
            }
          },
          lastModifiedBy: {
            user: {
              displayName: message.from?.user?.displayName || 'Unknown'
            }
          }
        });
      } catch (error) {
        console.error('Error processing message search hit:', error);
      }
    }
    
    // Sort results by score
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
    
  } catch (error) {
    console.error('Error searching Teams messages with Search API:', error);
    // If Search API fails, fall back to the traditional method
    try {
      const graphClient = await getGraphClient(await getValidAccessToken(userId));
      return traditionalTeamsSearch(graphClient, query);
    } catch (fallbackError) {
      console.error('Fallback Teams search also failed:', fallbackError);
      return [];
    }
  }
}

// Traditional Teams search method as a fallback
async function traditionalTeamsSearch(graphClient: any, query: string): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const isWildcardSearch = query === '*';

    // First get all teams the user is part of
    const teamsResponse = await graphClient
      .api('/me/joinedTeams')
      .get();

    // Search in channel messages
    for (const team of teamsResponse.value || []) {
      const channels = await graphClient
        .api(`/teams/${team.id}/channels`)
        .get();

      for (const channel of channels.value || []) {
        try {
          const messagesResponse = await graphClient
            .api(`/teams/${team.id}/channels/${channel.id}/messages`)
            .top(50)
            .get();

          if (messagesResponse?.value) {
            const channelMessages = messagesResponse.value
              .filter((msg: TeamsMessage) => {
                if (msg.messageType !== 'message') return false;
                if (isWildcardSearch) return true;
                
                const messageContent = msg.body?.content || '';
                const cleanContent = messageContent
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .toLowerCase();
                
                const fromName = msg.from?.user?.displayName?.toLowerCase() || '';
                
                return cleanContent.includes(lowerQuery) || fromName.includes(lowerQuery);
              })
              .map((msg: TeamsMessage) => {
                const messageContent = msg.body?.content || '';
                const cleanContent = messageContent
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();

                return {
                  id: msg.id,
                  name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
                  webUrl: msg.webUrl || '',
                  lastModifiedDateTime: msg.lastModifiedDateTime || msg.createdDateTime,
                  type: 'channel' as const,
                  preview: cleanContent,
                  score: 1, // Basic score for fallback results
                  from: {
                    name: msg.from?.user?.displayName || 'Unknown'
                  },
                  location: {
                    team: team.displayName || 'Unknown Team',
                    channel: channel.displayName || 'Unknown Channel'
                  },
                  createdBy: {
                    user: {
                      displayName: msg.from?.user?.displayName || 'Unknown'
                    }
                  },
                  lastModifiedBy: {
                    user: {
                      displayName: msg.from?.user?.displayName || 'Unknown'
                    }
                  }
                };
              });

            results.push(...channelMessages);
          }
        } catch (error) {
          console.error(`Error fetching messages for channel ${channel.displayName}:`, error);
          continue;
        }
      }
    }

    // Search in chat messages
    try {
      const chatsResponse = await graphClient
        .api('/me/chats')
        .get();

      for (const chat of chatsResponse.value || []) {
        const messagesResponse = await graphClient
          .api(`/me/chats/${chat.id}/messages`)
          .top(50)
          .get();

        if (messagesResponse?.value) {
          const chatMessages = messagesResponse.value
            .filter((msg: ChatMessage) => {
              if (msg.messageType !== 'message') return false;
              if (isWildcardSearch) return true;
              
              const messageContent = msg.body?.content || '';
              const cleanContent = messageContent
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
              
              const fromName = msg.from?.user?.displayName?.toLowerCase() || '';
              
              return cleanContent.includes(lowerQuery) || fromName.includes(lowerQuery);
            })
            .map((msg: ChatMessage) => {
              const messageContent = msg.body?.content || '';
              const cleanContent = messageContent
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

              return {
                id: msg.id,
                name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
                webUrl: msg.webUrl || '',
                lastModifiedDateTime: msg.lastModifiedDateTime || msg.createdDateTime,
                type: 'chat' as const,
                preview: cleanContent,
                score: 1, // Basic score for fallback results
                from: {
                  name: msg.from?.user?.displayName || 'Unknown'
                },
                location: {
                  team: 'Chat',
                  channel: chat.topic || 'Direct Message'
                },
                createdBy: {
                  user: {
                    displayName: msg.from?.user?.displayName || 'Unknown'
                  }
                },
                lastModifiedBy: {
                  user: {
                    displayName: msg.from?.user?.displayName || 'Unknown'
                  }
                }
              };
            });

          results.push(...chatMessages);
        }
      }
    } catch (error) {
      console.error('Error searching chat messages:', error);
    }

    // For wildcard search, sort by date instead of score
    if (isWildcardSearch) {
      return results.sort((a, b) => 
        new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
      );
    }

    // Sort all results by score
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch (error) {
    console.error('Error in fallback Teams search:', error);
    return [];
  }
} 