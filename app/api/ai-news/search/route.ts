import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Extract the user's sources and query from the request
    const { sources, query } = await req.json();

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: "Ingen gyldige kilder angitt" },
        { status: 400 }
      );
    }

    // Create a query prompt that includes the sources to search and the user's question
    let prompt = "";
    
    if (query) {
      // If there's a specific question, use it as the prompt
      prompt = `${query}\n\nSøk på følgende kilder for å svare på spørsmålet: ${sources.join(", ")}`;
    } else {
      // Default prompt for general news summary
      prompt = `Gi meg en oppsummering av de siste nyhetene fra følgende kilder: ${sources.join(
        ", "
      )}. Inkluder de viktigste nyhetene og begivenheter. Formatér svaret med HTML for bedre lesbarhet, bruk <h3> for overskrifter og <p> for avsnitt. Inkluder kildehenvisninger for hvert nyhetspunkt.`;
    }

    // Call OpenAI with web search enabled using the correct format
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt,
      text: {
        "format": {
          "type": "text"
        }
      },
      reasoning: {},
      tools: [
        {
          "type": "web_search_preview",
          "user_location": {
            "type": "approximate",
            "country": "NO"
          },
          "search_context_size": "high"
        }
      ],
      temperature: 1,
      max_output_tokens: 2048,
      top_p: 1,
      store: true
    });

    // Extract the text result from the response
    const result = response.output_text;

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error in AI news search:", error);
    return NextResponse.json(
      { error: "Kunne ikke fullføre søket" },
      { status: 500 }
    );
  }
} 