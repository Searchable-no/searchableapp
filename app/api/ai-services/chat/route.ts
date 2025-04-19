import { NextResponse } from "next/server";
import OpenAI from "openai";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type RequestData = {
  messages: ChatMessage[];
  model?: string;
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Prepare messages for OpenAI
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a helpful AI assistant that provides informative and detailed responses to user questions."
      },
      ...messages
    ];

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