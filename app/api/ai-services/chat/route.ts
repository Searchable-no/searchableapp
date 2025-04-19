import { NextResponse } from "next/server";
import OpenAI from "openai";
import { analyzeDocument } from "@/lib/document-intelligence";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: any[];
};

type RequestData = {
  messages: ChatMessage[];
  model?: string;
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get file content type
const getFileContentType = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, model = "gpt-4o" } = body as RequestData;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing or invalid messages" },
        { status: 400 }
      );
    }

    // Log all messages and check for attachments
    console.log(`======== CHAT API REQUEST ========`);
    console.log(`Model: ${model}`);
    console.log(`Total messages: ${messages.length}`);
    
    // Check for attachments in all messages
    const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0);
    console.log(`Messages with attachments: ${messagesWithAttachments.length}`);
    
    if (messagesWithAttachments.length > 0) {
      messagesWithAttachments.forEach((message, idx) => {
        console.log(`Message ${idx + 1} with ${message.attachments?.length || 0} attachments:`);
        console.log(`- Role: ${message.role}`);
        console.log(`- Content length: ${message.content.length} characters`);
        
        message.attachments?.forEach((attachment, aIdx) => {
          console.log(`  Attachment ${aIdx + 1}:`);
          console.log(`  - Type: ${attachment.type}`);
          console.log(`  - Name: ${attachment.name || attachment.subject || 'Unknown'}`);
          console.log(`  - Has content: ${!!attachment.content}`);
          if (attachment.content) {
            console.log(`  - Content length: ${attachment.content.length} characters`);
          }
        });
      });
    }
    console.log(`==================================`);

    // Process any attachments in the messages
    const processedMessages = await Promise.all(messages.map(async (message) => {
      // If no attachments, return the message as is
      if (!message.attachments || message.attachments.length === 0) {
        return {
          role: message.role,
          content: message.content,
        };
      }
      
      console.log(`Processing message with ${message.attachments?.length || 0} attachments`);
      
      // Format attachment descriptions, using content where available
      const attachmentDescriptions = message.attachments.map((attachment) => {
        // Add detailed logging for each attachment
        console.log(`Processing attachment in API: ${JSON.stringify({
          type: attachment.type,
          name: attachment.name || attachment.subject,
          hasContent: !!attachment.content,
          contentLength: attachment.content ? attachment.content.length : 0
        })}`);
        
        if (attachment.type === "email") {
          // For email attachments with content
          if (attachment.content) {
            console.log(`Including content for email "${attachment.name || attachment.subject}" (${attachment.content.length} characters)`);
            return `## Email: ${attachment.subject || attachment.name}
From: ${attachment.from?.emailAddress?.name || attachment.from?.emailAddress?.address || "Unknown"}
${attachment.receivedDateTime ? `Date: ${new Date(attachment.receivedDateTime).toLocaleString()}` : ''}

${attachment.content}`;
          } else {
            // For emails without content
            return `## Email: ${attachment.subject || attachment.name}
From: ${attachment.from?.emailAddress?.name || attachment.from?.emailAddress?.address || "Unknown"}
${attachment.receivedDateTime ? `Date: ${new Date(attachment.receivedDateTime).toLocaleString()}` : ''}

(No content available)`;
          }
        } else {
          // For file attachments with content
          const sizeInfo = attachment.size ? `(${Math.round(attachment.size / 1024)} KB)` : "(Size unknown)";
          
          if (attachment.content) {
            console.log(`Including content for "${attachment.name}" (${attachment.content.length} characters)`);
            return `## File: ${attachment.name} ${sizeInfo}

${attachment.content}`;
          } else {
            console.log(`No content available for "${attachment.name}"`);
            return `## File: ${attachment.name} ${sizeInfo}

(No content available)`;
          }
        }
      }).join("\n\n");
      
      // Combine content with attachment descriptions
      const enhancedContent = `${message.content || ""}

---
# Attachments
${attachmentDescriptions}
---`;
      
      return {
        role: message.role,
        content: enhancedContent,
      };
    }));

    // Prepare messages for OpenAI
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a helpful AI assistant that provides informative and detailed responses to user questions.

IMPORTANT: When the user has provided attachments (documents or emails):
1. Always analyze and reference the content from these attachments in your response
2. For emails, consider both the sender/recipient information and the content
3. For documents, extract key points and information related to the user's query
4. If multiple attachments are provided, analyze all of them and synthesize the information

Your goal is to provide high-quality, accurate answers that fully incorporate any information from the user's attachments.`
      },
      ...processedMessages
    ];

    // Log the context that will be sent to the AI (for debugging)
    console.log("========== LLM CONTEXT - ALL MESSAGES ==========");
    apiMessages.forEach((msg, idx) => {
      console.log(`Message ${idx + 1} (${msg.role}):`);
      if (msg.content && typeof msg.content === 'string') {
        console.log(`Content length: ${msg.content.length} characters`);
        console.log(`Preview: "${msg.content.substring(0, 100)}..."`);
      } else {
        console.log("No content");
      }
    });
    console.log("===============================================");
    
    // Add a summarized log of what was processed
    console.log("SUMMARY: Processed message details:");
    console.log(`- Total messages: ${messages.length}`);
    console.log(`- Messages with attachments: ${messagesWithAttachments.length}`);
    console.log(`- Total attachments processed: ${messagesWithAttachments.reduce((acc, msg) => acc + (msg.attachments?.length || 0), 0)}`);
    console.log(`- Final API message count: ${apiMessages.length}`);
    console.log(`- System message length: ${typeof apiMessages[0].content === 'string' ? apiMessages[0].content.length : 0} characters`);
    console.log("===============================================");

    // Create chat completion with streaming enabled
    const response = await openai.chat.completions.create({
      model,
      messages: apiMessages,
      temperature: 0.7,
      stream: true,
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Cast stream to AsyncIterable with a specific interface for the chunks
          for await (const chunk of response as AsyncIterable<{
            choices: Array<{
              delta: {
                content?: string;
              };
            }>;
          }>) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          console.error('Error in stream:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    // Return as a plain text stream
    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 