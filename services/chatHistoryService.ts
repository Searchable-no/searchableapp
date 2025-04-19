import { supabase } from '@/lib/supabase-browser';
import { ChatHistory, ChatType } from '@/types/chat';
import { Message } from '@/components/ai-services/Chat';

export const chatHistoryService = {
  // Save new chat or update existing one
  async saveChat(
    userId: string,
    type: ChatType, 
    messages: Message[], 
    title: string, 
    threadId?: string,
    metadata?: Record<string, unknown>,
    existingChatId?: string
  ): Promise<string | null> {
    try {
      console.log('Starting saveChat with userId:', userId);
      
      // Prepare data
      const chatData: Partial<ChatHistory> = {
        title,
        type,
        content: { 
          messages,
          lastMessage: messages.length > 0 ? messages[messages.length - 1].content : ''
        },
        user_id: userId,
        metadata
      };
      
      if (threadId) {
        chatData.thread_id = threadId;
      }
      
      let result;
      
      if (existingChatId) {
        console.log('Updating existing chat:', existingChatId);
        // Update existing chat
        result = await supabase
          .from('chat_history')
          .update(chatData)
          .eq('id', existingChatId)
          .select('id');
      } else {
        console.log('Inserting new chat');
        // Insert new chat
        result = await supabase
          .from('chat_history')
          .insert(chatData)
          .select('id');
      }
      
      if (result.error) {
        console.error('Error saving chat history:', result.error);
        console.error('Error details:', result.error.message, result.error.details);
        return null;
      }
      
      console.log('Chat saved successfully, ID:', result.data?.[0]?.id);
      return result.data?.[0]?.id || null;
    } catch (error) {
      console.error('Error in saveChat:', error);
      return null;
    }
  },
  
  // Get all chats for a user
  async getUserChats(userId: string, type?: ChatType): Promise<ChatHistory[]> {
    try {
      let query = supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
        
      if (type) {
        query = query.eq('type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching user chats:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getUserChats:', error);
      return [];
    }
  },
  
  // Get a specific chat by ID
  async getChatById(chatId: string): Promise<ChatHistory | null> {
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('id', chatId)
        .single();
      
      if (error) {
        console.error('Error fetching chat by ID:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getChatById:', error);
      return null;
    }
  },
  
  // Delete a chat
  async deleteChat(chatId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('id', chatId);
      
      if (error) {
        console.error('Error deleting chat:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteChat:', error);
      return false;
    }
  }
}; 