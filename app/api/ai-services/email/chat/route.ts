import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { EmailMessage } from "@/lib/microsoft-graph";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to validate the request data
function validateRequestData(data: any) {
  if (!data.messages || !Array.isArray(data.messages)) {
    return "Missing or invalid messages";
  }

  if (!data.emailId) {
    return "Missing email ID";
  }

  if (!data.storedEmail) {
    return "Missing email data";
  }

  return null;
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

    const { messages, emailId, storedEmail } = data;
    const email = storedEmail as EmailMessage;

    console.log(`Processing email chat for email ID: ${emailId}`);

    // Create a system message with email context
    const emailContext = `
You are an AI assistant helping the user craft responses to an email. Here is the email information:

Subject: ${email.subject || "No subject"}
From: ${email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown"}
Received: ${new Date(email.receivedDateTime).toLocaleString()}
Body: ${email.bodyPreview || "No body preview available"}

You always respond in Norwegian unless explicitly asked to use another language.
Please help the user craft a professional and appropriate response to this email. You may suggest complete email replies or help them structure their thoughts. Keep your suggestions relevant to the email content and context.
`;

    // Set up streaming response
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: emailContext },
        ...messages.map((message: any) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      temperature: 0.7,
      stream: true,
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
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