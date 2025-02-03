import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { index as pineconeIndex } from '@/lib/pinecone'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ progress: 0 });
    }

    // Get total indexed items from Pinecone
    const { matches } = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
      filter: { userId: user.id },
      topK: 10000,
      includeMetadata: true,
    });

    // Get connection status to check if connected and get metadata
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ progress: 0 });
    }

    // Get the total items to index from metadata if available
    const totalToIndex = connection.metadata?.totalItems || 1000; // Fallback to 1000 if not set
    
    // Calculate progress based on actual items found vs total to index
    const progress = Math.min(100, Math.round((matches?.length || 0) * 100 / totalToIndex));

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error getting indexing status:', error);
    return NextResponse.json({ error: 'Failed to get indexing status' }, { status: 500 });
  }
} 