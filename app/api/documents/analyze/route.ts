import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument } from '@/lib/document-intelligence';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { downloadSharePointFile } from '@/lib/microsoft-graph';

export async function POST(req: NextRequest) {
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

    // Parse request body
    const body = await req.json();
    const { fileUrl, fileName, fileType, fileSize, lastModified } = body;

    // Validate required parameters
    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileUrl and fileName are required' },
        { status: 400 }
      );
    }

    console.log(`Processing document analysis request for file: ${fileName}`);
    console.log(`File URL: ${fileUrl}`);
    console.log(`File type: ${fileType}`);
    console.log(`File size: ${fileSize ? Math.round(fileSize / 1024) + ' KB' : 'unknown'}`);

    try {
      // Try to download the file using Microsoft Graph API with user authentication
      console.log(`Downloading file using Microsoft Graph API...`);
      const fileBuffer = await downloadSharePointFile(userData.id, fileUrl);
      console.log(`Successfully downloaded file: ${fileName} (${fileBuffer.byteLength} bytes)`);

      // Now call the Document Intelligence API directly with the file buffer
      console.log(`Sending file to Document Intelligence API...`);
      const documentContent = await analyzeDocument(
        fileBuffer, // Send the file buffer directly
        fileName,
        fileType,
        fileSize,
        lastModified
      );

      // Return document content
      return NextResponse.json({ success: true, documentContent });
    } catch (error: any) {
      console.error(`Error processing document: ${error.message}`);
      throw error; // Re-throw to be caught by the outer catch
    }
  } catch (error: any) {
    console.error('Error analyzing document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze document' },
      { status: 500 }
    );
  }
} 