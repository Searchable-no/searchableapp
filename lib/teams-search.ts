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

export async function searchTeamsMessages(userId: string, query: string): Promise<SearchResult[]> {
  try {
    const accessToken = await getValidAccessToken(userId);
    const graphClient = await getGraphClient(accessToken);
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

                // Calculate score
                let score = 0;
                if (!isWildcardSearch) {
                  const lowerContent = cleanContent.toLowerCase();
                  const fromName = msg.from?.user?.displayName?.toLowerCase() || '';

                  if (lowerContent === lowerQuery) score += 100;
                  else if (lowerContent.includes(lowerQuery)) score += 50;
                  if (fromName.includes(lowerQuery)) score += 30;
                }

                return {
                  id: msg.id,
                  name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
                  webUrl: msg.webUrl || '',
                  lastModifiedDateTime: msg.lastModifiedDateTime || msg.createdDateTime,
                  type: 'channel' as const,
                  preview: cleanContent,
                  score,
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

              // Calculate score
              let score = 0;
              if (!isWildcardSearch) {
                const lowerContent = cleanContent.toLowerCase();
                const fromName = msg.from?.user?.displayName?.toLowerCase() || '';

                if (lowerContent === lowerQuery) score += 100;
                else if (lowerContent.includes(lowerQuery)) score += 50;
                if (fromName.includes(lowerQuery)) score += 30;
              }

              return {
                id: msg.id,
                name: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
                webUrl: msg.webUrl || '',
                lastModifiedDateTime: msg.lastModifiedDateTime || msg.createdDateTime,
                type: 'chat' as const,
                preview: cleanContent,
                score,
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
    return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  } catch (error) {
    console.error('Error searching Teams messages:', error);
    return [];
  }
} 