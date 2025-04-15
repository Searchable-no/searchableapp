import { NextResponse } from 'next/server';
import { getTranscriptionResult, hasTranscriptionResult, getAllTranscriptionIds } from '../../store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptionId = params.id;
    
    if (!transcriptionId) {
      return NextResponse.json(
        { error: 'Transcription ID is required' },
        { status: 400 }
      );
    }

    console.log('Checking status for transcription:', transcriptionId);
    
    // Debug storage state
    const allIds = getAllTranscriptionIds();
    console.log('All stored transcription IDs:', allIds);
    console.log('Total stored transcriptions:', allIds.length);
    console.log('Has result in store:', hasTranscriptionResult(transcriptionId));
    
    const result = getTranscriptionResult(transcriptionId);
    console.log('Result type for', transcriptionId, ':', typeof result);
    
    if (!result) {
      console.log('No result found for transcription:', transcriptionId);
      return NextResponse.json({ status: 'processing' });
    }

    if (result.status === 'completed') {
      console.log('Returning completed transcription:', {
        id: transcriptionId,
        textLength: result.text?.length || 0,
        segmentsCount: result.segments?.length
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
} 