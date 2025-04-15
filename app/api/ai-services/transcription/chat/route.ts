import OpenAI from 'openai';
import { getTranscriptionResult, getAllTranscriptionIds, setTranscriptionResult } from '../../transcription/store';

// Create OpenAI client with API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge'; // To support streaming

// Helper function to create a properly formatted streaming response
function createStream(res: AsyncIterable<any>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;
  
  const stream = new ReadableStream({
    async start(controller) {
      // Function to handle each chunk
      function onParse(event: { type: string; data: string }) {
        if (event.type === 'event') {
          const data = event.data;
          // If we've reached the end, close the stream
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          
          try {
            // Parse the data from the event
            const json = JSON.parse(data);
            const text = json.choices[0]?.delta?.content || '';
            
            if (text) {
              // Increment the counter and send the token
              counter++;
              controller.enqueue(encoder.encode(text));
            }
          } catch (e) {
            // Handle any parsing errors
            controller.error(e);
          }
        }
      }
      
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
    const { messages, transcriptionId, storedTranscription } = await req.json();
    
    // Debug - log all available IDs
    const allIds = getAllTranscriptionIds();
    console.log(`Available transcription IDs: ${allIds.join(', ') || 'none'}`);
    console.log(`Requested transcription ID: ${transcriptionId}`);
    console.log(`Client provided stored transcription: ${storedTranscription ? 'yes' : 'no'}`);

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
    const systemMessage = {
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

    // Add system message as first message
    const apiMessages = [
      systemMessage,
      ...messages
    ];

    // Create chat completion with streaming enabled
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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