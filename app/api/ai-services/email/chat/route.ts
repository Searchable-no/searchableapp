import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { EmailMessage } from "@/lib/microsoft-graph";
import { ReactNode } from "react";

// Add type definitions
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

type RequestData = {
  messages: ChatMessage[];
  emailId?: string;
  storedEmail?: EmailMessage;
  threadId?: string;
  emailThread?: EmailMessage[];
  model?: string;
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to validate the request data
function validateRequestData(data: RequestData) {
  if (!data.messages || !Array.isArray(data.messages)) {
    return "Missing or invalid messages";
  }

  // Check for either single email or thread data
  if ((data.emailId && data.storedEmail) || (data.threadId && data.emailThread)) {
    return null;
  }

  return "Missing email or thread data";
}

export async function POST(request: NextRequest) {
  console.log("Email chat API called");
  try {
    // Get the auth cookie directly
    const cookies = request.headers.get('cookie') || '';
    console.log("Cookies header:", cookies ? "Present" : "Missing");
    
    // Extract token from cookies
    const authCookieName = 'sb-hswomyklnknfhmnlivgj-auth-token';
    const authCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith(`${authCookieName}=`));
    
    if (!authCookie) {
      console.error("Auth cookie not found");
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    
    console.log("Auth cookie found, proceeding with request");
    
    // Parse request body
    const data = await request.json();
    
    // Validate request
    const validationError = validateRequestData(data);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { messages, emailId, storedEmail, threadId, emailThread, model } = data;

    // Create system message based on whether we have a single email or thread
    let emailContext = "";
    
    if (emailId && storedEmail) {
      console.log(`Processing email chat for email ID: ${emailId}, model: ${model || 'default'}`);
      const email = storedEmail as EmailMessage;
      emailContext = createSingleEmailContext(email);
    } else if (threadId && emailThread) {
      console.log(`Processing email thread chat for thread ID: ${threadId}, model: ${model || 'default'}`);
      emailContext = createThreadContext(emailThread);
    }

    // Logg systemkonteksten som sendes til LLM-en
    console.log("========== LLM SYSTEM CONTEXT ==========");
    console.log(emailContext);
    console.log("========================================");

    // Set up streaming response
    const modelToUse = model || process.env.OPENAI_MODEL || "gpt-4o";
    
    // Process each message to include attachment information
    const processedMessages = messages.map((message: ChatMessage) => {
      // If no attachments, return the message as is
      if (!message.attachments || message.attachments.length === 0) {
        return {
          role: message.role,
          content: message.content,
        };
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
      
      return {
        role: message.role,
        content: enhancedContent,
      };
    });
    
    // Base config object without temperature
    const completionConfig = {
      model: modelToUse,
      messages: [
        { role: "system", content: emailContext },
        ...processedMessages,
      ],
      stream: true,
    };
    
    // Logg alle meldinger som sendes til LLM-en
    console.log("========== FULL LLM CONVERSATION ==========");
    console.log(JSON.stringify(completionConfig.messages, null, 2));
    console.log("===========================================");
    
    // Add temperature only for models that support it
    if (modelToUse !== "o4-mini") {
      Object.assign(completionConfig, { temperature: 0.7 });
    }
    
    const stream = await openai.chat.completions.create(completionConfig);

    // Create a streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Cast stream to AsyncIterable with a specific interface for the chunks
          for await (const chunk of stream as AsyncIterable<{
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
    console.error("Error in email chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper to create context for a single email
function createSingleEmailContext(email: EmailMessage): string {
  // Use full email body content if available, otherwise use bodyPreview
  const emailContent = email.body?.content 
    ? (email.body.contentType.includes("html") 
        ? stripHtmlTags(email.body.content) 
        : email.body.content)
    : (email.bodyPreview || "No content available");

  return `
You are an AI assistant helping the user craft responses to an email. Here is the email information:

Subject: ${email.subject || "No subject"}
From: ${email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown"}
Received: ${new Date(email.receivedDateTime).toLocaleString()}
Body: ${emailContent}

You always respond in Norwegian unless explicitly asked to use another language.
Please help the user craft a professional and appropriate response to this email. You may suggest complete email replies or help them structure their thoughts. Keep your suggestions relevant to the email content and context.le 
`;
}

// Helper to create context for an email thread
function createThreadContext(emails: EmailMessage[]): string {
  // Log the original email count and content lengths
  console.log(`Creating thread context for ${emails.length} emails`);
  emails.forEach((email, i) => {
    console.log(`Email ${i+1} content stats:
    - Subject: ${email.subject || "No subject"}
    - From: ${email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown"}
    - bodyPreview length: ${email.bodyPreview?.length || 0}
    - body.content length: ${email.body?.content?.length || 0}
    - Is sent by user: ${email.isSent ? "Yes" : "No"}`);
    
    // Debug the content to check for truncation or missing parts
    if (!email.body?.content && email.bodyPreview) {
      console.warn(`Email ${i+1} is missing body.content but has bodyPreview - likely serialization issue`);
    }
  });
  
  // Sort emails by date (oldest first)
  const sortedEmails = [...emails].sort(
    (a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
  );
  
  // Generate a summary of the thread, preferring full body content
  const threadSummary = sortedEmails.map((email, index) => {
    // Determine sender - more explicit about who sent it
    const sender = email.isSent ? 
      "User (You)" : 
      (email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown");
    
    // Check if we have body content and it's not empty
    let emailContent = "";
    
    if (email.body?.content) {
      // Use the full content with proper HTML handling
      console.log(`Email ${index + 1}: Using complete body content (${email.body.content.length} chars)`);
      emailContent = email.body.contentType?.includes("html") 
        ? stripHtmlTags(email.body.content) 
        : email.body.content;
    } else if (email.bodyPreview) {
      // Fall back to preview if full body isn't available
      console.warn(`Email ${index + 1}: Using bodyPreview instead of full content (${email.bodyPreview.length} chars)`);
      emailContent = email.bodyPreview;
    } else {
      emailContent = "No content available";
      console.warn(`Email ${index + 1} has no content`);
    }
    
    // Log the processed content length
    console.log(`Email ${index + 1} from ${sender}: Processed content length = ${emailContent.length} characters`);
    
    return `Email ${index + 1} from ${sender} (${new Date(email.receivedDateTime).toLocaleString()}):
Subject: ${email.subject || "No subject"}
${emailContent}
`;
  }).join("\n\n");
  
  // Log the final context length
  console.log(`Final thread context length: ${threadSummary.length} characters`);
  
  return `
You are an AI assistant helping the user craft responses to an email thread. Here is the full thread containing ${emails.length} emails:

${threadSummary}

You always respond in Norwegian unless explicitly asked to use another language.
Please help the user craft a professional and appropriate response to this email thread. You may suggest complete email replies or help them structure their thoughts. Keep your suggestions relevant to the discussion history and context. Be aware of the full conversation history when formulating your response.
`;
}

// Helper function to strip HTML tags from content - improved version
function stripHtmlTags(html: string): string {
  if (!html) return "";
  
  // First, replace common HTML entities
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Fix potential whitespace issues
  text = text
    .replace(/\s+/g, ' ')        // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();                     // Remove leading/trailing whitespace
    
  return text;
} 