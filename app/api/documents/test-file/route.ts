import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument } from '@/lib/document-intelligence';
import { getSharePointFile } from '@/lib/microsoft-graph';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    // Authenticate with Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
      
    if (authError || !user?.email) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get user ID from database
    const { data: userData, error: userDbError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();
      
    if (userDbError || !userData) {
      console.error('User DB error:', userDbError);
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
    }
    
    console.log(`Testing document analysis for SharePoint file ID: ${fileId}`);
    
    // Get file details from SharePoint
    console.log(`Fetching file details from SharePoint...`);
    const file = await getSharePointFile(userData.id, fileId);
    
    if (!file || !file.webUrl) {
      console.error('File not found or no webUrl available');
      return NextResponse.json({ error: 'File not found or no URL available' }, { status: 404 });
    }
    
    console.log(`File details retrieved:
  Name: ${file.name}
  Size: ${file.size ? Math.round(file.size / 1024) + ' KB' : 'unknown'}
  URL: ${file.webUrl}
  Last Modified: ${file.lastModifiedDateTime || 'unknown'}`);
    
    // Test analyze document
    console.log(`Analyzing document content...`);
    const result = await analyzeDocument(
      file.webUrl,
      file.name,
      getFileContentType(file.name),
      file.size,
      file.lastModifiedDateTime
    );
    
    console.log(`Document analyzed successfully. Content length: ${result.content.length} characters`);
    
    return NextResponse.json({
      success: true,
      contentLength: result.content.length,
      contentPreview: result.content.substring(0, 200) + '...',
      metadata: result.metadata,
      fileDetails: {
        name: file.name,
        size: file.size,
        webUrl: file.webUrl,
        lastModifiedDateTime: file.lastModifiedDateTime
      }
    });
  } catch (error: any) {
    console.error('Error testing document analysis:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
}

// Helper to determine file MIME type from filename
function getFileContentType(fileName: string): string | undefined {
  if (!fileName) return undefined;
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
} 