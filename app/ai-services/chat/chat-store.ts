'use client';

import { proxy, useSnapshot } from 'valtio';
import { Message, Microsoft365Resource } from '@/types/message';
import { chatHistoryService } from '@/services/chatHistoryService';

// For stopping chat generation
let abortController: AbortController | null = null;

type ChatStatus = 'idle' | 'loading' | 'error';

class ChatState {
  public messages: Message[] = [];
  public loading: ChatStatus = 'idle';
  public input: string = '';
  public lastMessage: string = '';
  public autoScroll: boolean = true;
  public userName: string = '';
  public userId: string = '';
  public chatId: string | null = null;
  public chatTitle: string = 'New Chat';
  public selectedModel: string = 'gpt-4o';
  public error: string | null = null;
  public bookmarked: boolean = false;

  public initChatSession({
    chatId,
    messages,
    title,
    userId,
    userName,
    bookmarked = false,
  }: {
    chatId: string | null;
    messages: Message[];
    title: string;
    userId: string;
    userName: string;
    bookmarked?: boolean;
  }) {
    this.chatId = chatId;
    this.messages = messages;
    this.chatTitle = title || 'New Chat';
    this.userId = userId;
    this.userName = userName;
    this.bookmarked = bookmarked;
    this.loading = 'idle';
    this.error = null;
  }

  public updateInput(value: string) {
    this.input = value;
  }

  public setSelectedModel(model: string) {
    this.selectedModel = model;
  }

  public stopGeneratingMessages() {
    if (abortController !== null) {
      abortController.abort();
      this.loading = 'idle';
    }
  }
  
  public updateAutoScroll(value: boolean) {
    this.autoScroll = value;
  }

  private reset() {
    abortController = null;
    this.loading = 'loading';
    this.input = '';
    this.lastMessage = '';
  }

  public async saveChatHistory(messagesArray: Message[]) {
    if (!this.userId) {
      console.error("Cannot save chat history: userId is missing");
      return null;
    }

    try {
      console.log("Saving chat history for user:", this.userId);
      console.log("Current messages count:", messagesArray.length);
      
      // Validate messages before saving
      if (!messagesArray || messagesArray.length === 0) {
        console.error("No messages to save");
        return null;
      }

      // For title, use the first few words of the first user message
      const firstUserMessage = messagesArray.find(m => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.split(" ").slice(0, 5).join(" ") + "..."
        : "New Chat";

      if (title !== this.chatTitle) {
        this.chatTitle = title;
      }

      console.log("Saving chat with title:", title);
      console.log("Existing chatId:", this.chatId);

      const savedChatId = await chatHistoryService.saveChat(
        this.userId,
        "normal",
        messagesArray,
        title,
        undefined, // No thread_id for general chat
        { bookmarked: this.bookmarked }, // Add bookmarked status to metadata
        this.chatId || undefined
      );

      console.log("Chat saved with ID:", savedChatId);

      if (savedChatId && !this.chatId) {
        this.chatId = savedChatId;
        
        // Use the same event system for consistency
        const chatIdUpdateEvent = new CustomEvent('chatIdCreated', { 
          detail: { chatId: savedChatId }
        });
        window.dispatchEvent(chatIdUpdateEvent);
        console.log("Dispatched chatIdCreated event with:", savedChatId);
      }

      return savedChatId;
    } catch (error) {
      console.error("Error saving chat history:", error);
      return null;
    }
  }

  public async submitMessage(message: string, attachments?: Microsoft365Resource[]) {
    if (!message.trim() || this.loading !== 'idle') {
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: message,
      attachments: attachments
    };

    const updatedMessages = [...this.messages, userMessage];
    this.messages = updatedMessages;

    // Create chat if it doesn't exist (with or without ID)
    if (!this.chatId && this.userId) {
      console.log("No chatId exists, creating a new chat before submitting message");
      // For title, use the first few words of the message
      const title = message.split(" ").slice(0, 5).join(" ") + "...";
      const newChatId = await chatHistoryService.saveChat(
        this.userId,
        "normal",
        updatedMessages,
        title,
        undefined,
        { bookmarked: this.bookmarked }
      );
      
      if (newChatId) {
        console.log("Created new chat with ID:", newChatId);
        this.chatId = newChatId;
        
        // IMPORTANT: This is being handled differently now.
        // Instead of using window.history.pushState which may not be working,
        // we'll dispatch an event that the page component will listen for
        const chatIdUpdateEvent = new CustomEvent('chatIdCreated', { 
          detail: { chatId: newChatId }
        });
        window.dispatchEvent(chatIdUpdateEvent);
        console.log("Dispatched chatIdCreated event with:", newChatId);
      } else {
        console.error("Failed to create new chat before sending message");
      }
    } 
    // Otherwise, save message to existing chat
    else if (this.userId) {
      console.log("Saving message to existing chat:", this.chatId);
      await this.saveChatHistory(updatedMessages);
    }

    this.reset();

    const controller = new AbortController();
    abortController = controller;

    try {
      // Make API request
      const response = await fetch("/api/ai-services/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          model: this.selectedModel,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error communicating with chat API");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get response reader");

      let assistantMessage = "";

      // Create a placeholder for the streaming message
      const messagesWithPlaceholder = [
        ...updatedMessages,
        { role: "assistant" as const, content: "" },
      ];
      this.messages = messagesWithPlaceholder;

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        assistantMessage += chunk;

        // Update the assistant message with what we've received so far
        const updatedMessagesWithAssistant = [
          ...updatedMessages,
          {
            role: "assistant" as const,
            content: assistantMessage,
          },
        ];

        this.messages = updatedMessagesWithAssistant;
      }

      // Save the complete conversation to chat history
      const finalMessages = [
        ...updatedMessages,
        {
          role: "assistant" as const,
          content: assistantMessage,
        },
      ];

      this.lastMessage = assistantMessage;

      if (this.userId) {
        console.log("Saving complete chat history with assistant response. Message count:", finalMessages.length);
        const finalSavedId = await this.saveChatHistory(finalMessages);
        console.log("Saved complete chat history, ID:", finalSavedId);
        
        // Double-check that the chat was saved properly
        if (finalSavedId) {
          console.log("Verifying saved chat...");
          const savedChat = await chatHistoryService.getChatById(finalSavedId);
          console.log(`Verification: Found ${savedChat?.content?.messages?.length || 0} messages in saved chat`);
        }
      }
    } catch (error) {
      console.error("Error in chat:", error);
      this.error = error instanceof Error ? error.message : "Unknown error";
    } finally {
      this.loading = 'idle';
    }
  }

  public async loadChatHistory(historyChatId: string) {
    try {
      if (!this.userId) {
        console.error("Cannot load chat history: userId is missing");
        return;
      }

      if (!historyChatId) {
        console.error("Cannot load chat history: historyChatId is missing");
        this.error = "Missing chat ID";
        return;
      }

      console.log("Loading chat history:", historyChatId);
      const chatHistory = await chatHistoryService.getChatById(historyChatId);

      if (!chatHistory) {
        console.error("Chat history not found for ID:", historyChatId);
        this.error = "Chat history not found";
        return;
      }

      if (chatHistory.user_id !== this.userId) {
        console.error("Chat history not owned by this user");
        this.error = "You don't have access to this chat";
        return;
      }

      console.log("Chat history loaded:", chatHistory);
      
      // Ensure messages are properly loaded
      if (chatHistory.content && 
          Array.isArray(chatHistory.content.messages) && 
          chatHistory.content.messages.length > 0) {
        console.log("Message count in history:", chatHistory.content.messages.length);
        
        // Validate each message object
        const validMessages = chatHistory.content.messages
          .filter(msg => msg && typeof msg === 'object' && ('role' in msg) && ('content' in msg))
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content as string,
            attachments: msg.attachments || undefined
          }));
          
        console.log("Valid messages found:", validMessages.length);
        this.messages = validMessages;
      } else {
        console.log("No messages found in chat history or empty chat");
        this.messages = [];
      }
      
      this.chatTitle = chatHistory.title || "New Chat";
      this.chatId = historyChatId;
      this.bookmarked = chatHistory.bookmarked || false;
    } catch (error) {
      console.error("Error loading chat history:", error);
      this.error = "Failed to load chat history";
    }
  }

  public async toggleBookmark() {
    if (!this.chatId || !this.userId) return false;

    try {
      const success = await chatHistoryService.toggleBookmark(this.chatId, this.bookmarked);
      if (success) {
        this.bookmarked = !this.bookmarked;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      return false;
    }
  }

  public async updateTitle(newTitle: string) {
    if (!this.chatId || !this.userId || !newTitle.trim()) return false;

    try {
      const success = await chatHistoryService.updateTitle(this.chatId, newTitle);
      if (success) {
        this.chatTitle = newTitle;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating title:", error);
      return false;
    }
  }

  public async deleteChat() {
    if (!this.chatId || !this.userId) return false;

    try {
      return await chatHistoryService.softDeleteChat(this.chatId);
    } catch (error) {
      console.error("Error deleting chat:", error);
      return false;
    }
  }
}

export const chatStore = proxy(new ChatState());

export const useChat = () => {
  return useSnapshot(chatStore);
}; 