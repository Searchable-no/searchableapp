import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument } from '@/lib/document-intelligence';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fileUrl = url.searchParams.get('url');
    
    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl parameter' }, { status: 400 });
    }
    
    console.log(`Testing document analysis with URL: ${fileUrl}`);
    
    // Test analyze document
    const result = await analyzeDocument(
      fileUrl,
      'test-document.pdf',
      'application/pdf'
    );
    
    console.log(`Document analyzed successfully. Content length: ${result.content.length} characters`);
    
    return NextResponse.json({
      success: true,
      contentLength: result.content.length,
      contentPreview: result.content.substring(0, 200) + '...',
      metadata: result.metadata
    });
  } catch (error: any) {
    console.error('Error testing document analysis:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
} 