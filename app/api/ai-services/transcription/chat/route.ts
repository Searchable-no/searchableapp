import OpenAI from 'openai';
import { getTranscriptionResult, getAllTranscriptionIds, setTranscriptionResult } from '../../transcription/store';
import { ReactNode } from 'react';

// Define message types with attachment support
type Microsoft365Resource = {
  id: string;
  name: string;
  type: "email" | "file";
  icon?: ReactNode;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  receivedDateTime?: string;
  subject?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Microsoft365Resource[];
};

// Create OpenAI client with API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge'; // To support streaming

// Helper function to create a properly formatted streaming response
function createStream(res: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Process the response from OpenAI as a stream
      try {
        for await (const chunk of res) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

export async function POST(req: Request) {
  try {
    const { messages, transcriptionId, storedTranscription, model } = await req.json();
    
    // Debug - log all available IDs
    const allIds = getAllTranscriptionIds();
    console.log(`Available transcription IDs: ${allIds.join(', ') || 'none'}`);
    console.log(`Requested transcription ID: ${transcriptionId}`);
    console.log(`Client provided stored transcription: ${storedTranscription ? 'yes' : 'no'}`);
    console.log(`Selected model: ${model || process.env.OPENAI_MODEL || 'gpt-4o'}`);

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid message format" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!transcriptionId) {
      return new Response(JSON.stringify({ error: "Transcription ID is required" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // First try to get from server memory
    let transcription = getTranscriptionResult(transcriptionId);
    
    // If not found in server but client provided it from localStorage, use that
    if (!transcription && storedTranscription) {
      console.log("Using client-provided transcription from localStorage");
      // Save it to server memory for future requests
      setTranscriptionResult(transcriptionId, storedTranscription);
      transcription = storedTranscription;
    }
    
    // More debugging
    console.log(`Transcription found: ${transcription ? 'yes' : 'no'}`);
    if (transcription) {
      console.log(`Transcription status: ${transcription.status}`);
      console.log(`Transcription has text: ${transcription.text ? 'yes' : 'no'}`);
    }
    
    if (!transcription || !transcription.text) {
      return new Response(JSON.stringify({ error: "Transcription not found", requestedId: transcriptionId, availableIds: allIds }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build system prompt with the transcription
    const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
      role: "system",
      content: `You are an assistant who helps analyze a transcription. 
The user will ask you questions about the transcription, and you should answer based on its content.
Here is the transcription:

${transcription.text}

Be helpful, precise and focus on facts from the transcription. If a question cannot 
be answered based on the transcription, politely say so.

Make sure to format your responses with headings, bullet points, and other markdown elements.

`
    };

    // Process each message to include attachment information if present
    const processedMessages = messages.map((message: ChatMessage) => {
      // If no attachments, return the message as is
      if (!message.attachments || message.attachments.length === 0) {
        if (message.role === "user") {
          return {
            role: "user",
            content: message.content,
          } as OpenAI.Chat.ChatCompletionUserMessageParam;
        } else if (message.role === "assistant") {
          return {
            role: "assistant",
            content: message.content,
          } as OpenAI.Chat.ChatCompletionAssistantMessageParam;
        } else {
          return {
            role: "system",
            content: message.content,
          } as OpenAI.Chat.ChatCompletionSystemMessageParam;
        }
      }
      
      // Format attachment descriptions
      const attachmentDescriptions = message.attachments.map((attachment: Microsoft365Resource) => {
        if (attachment.type === "email") {
          return `- Email: "${attachment.name}" from ${attachment.from?.emailAddress?.name || attachment.from?.emailAddress?.address || "Unknown"}`;
        } else {
          return `- File: "${attachment.name}" (${attachment.size ? Math.round(attachment.size / 1024) + " KB" : "Size unknown"})`;
        }
      }).join("\n");
      
      // Combine content with attachment descriptions
      const enhancedContent = `${message.content || ""}

---
Attachments:
${attachmentDescriptions}
---`;
      
      if (message.role === "user") {
        return {
          role: "user",
          content: enhancedContent,
        } as OpenAI.Chat.ChatCompletionUserMessageParam;
      } else if (message.role === "assistant") {
        return {
          role: "assistant",
          content: enhancedContent,
        } as OpenAI.Chat.ChatCompletionAssistantMessageParam;
      } else {
        return {
          role: "system",
          content: enhancedContent,
        } as OpenAI.Chat.ChatCompletionSystemMessageParam;
      }
    });

    // Add system message as first message
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      systemMessage,
      ...processedMessages
    ];

    // Create chat completion with streaming enabled
    const response = await openai.chat.completions.create({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o',
      messages: apiMessages,
      temperature: 0.7,
      stream: true,
    });

    // Create stream from the response
    const stream = createStream(response);
    
    // Return as a streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 