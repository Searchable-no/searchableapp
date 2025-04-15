import { NextResponse } from 'next/server';
import { getTranscriptionResult, getAllTranscriptionIds } from '../store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'No transcription ID provided' }, { status: 400 });
  }

  const result = getTranscriptionResult(id);
  
  // Debug logs
  console.log(`Status check for transcription ID: ${id}`);
  console.log(`All transcription IDs in memory: ${getAllTranscriptionIds().join(', ') || 'none'}`);
  console.log(`Found in memory: ${result ? 'yes' : 'no'}`);
  
  if (result) {
    return NextResponse.json(result);
  } 
  
  // If not found in memory but ID looks valid, return a fake completed status
  // This allows the client to continue with the localStorage transcription
  if (id.startsWith('el_')) {
    console.log(`Transcription not found in memory, but returning success response for client recovery`);
    
    return NextResponse.json({
      transcriptionId: id,
      status: 'completed',
      text: 'The transcription is available in the browser. Please use the chat feature to interact with it.',
      segments: [],
      minuteSegments: []
    });
  }

  return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });
} 