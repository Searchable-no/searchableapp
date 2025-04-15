import { NextResponse } from 'next/server';
import { hasTranscriptionResult, getAllTranscriptionIds } from '../store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
  }

  const exists = hasTranscriptionResult(id);
  const allIds = getAllTranscriptionIds();

  return NextResponse.json({
    exists,
    requestedId: id,
    allIds: allIds,
    count: allIds.length
  });
} 