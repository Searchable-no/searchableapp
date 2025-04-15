import { NextResponse } from "next/server";
import OpenAI from "openai";

// Single, well-structured summary prompt
const SUMMARY_PROMPT = `Create a structured summary of the provided transcript in Norwegian.

The summary should be clear, concise, and easy to understand, focusing on the most important information.

# Steps
1. Read the entire transcript to understand the discussion flow and main points.
2. Identify key elements:
   - Main topics and themes discussed
   - Important decisions or conclusions
   - Essential facts or statements
   - Any action items or responsibilities mentioned

3. Structure the summary in a clear, organized format:
   - Start with a brief overview (1-2 sentences)
   - Group information by main topics with clear headers
   - Use bullet points for key points under each topic
   - End with any important conclusions

# Output Format
- Write in Norwegian
- Use clear, straightforward language
- Include headers for different sections
- Use bullet points for better readability
- Keep it structured and scannable`;

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: SUMMARY_PROMPT,
        },
        {
          role: "user",
          content: `Vennligst lag et strukturert sammendrag av følgende transkripsjon:\n\n${text}`,
        },
      ],
      temperature: 0.15
    });

    const summary = response.choices[0]?.message?.content || "Kunne ikke generere sammendrag";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate summary" },
      { status: 500 }
    );
  }
} 