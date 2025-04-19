import { Message } from '@/components/ai-services/Chat';

export type ChatType = 'normal' | 'transcription' | 'email';

export interface ChatHistory {
  id?: string;
  created_at?: string;
  updated_at?: string;
  title: string;
  type: ChatType;
  content: {
    messages: Message[];
    lastMessage?: string;
  };
  user_id: string;
  thread_id?: string;
  metadata?: Record<string, unknown>;
} 