/**
 * Azure Document Intelligence service for processing document content
 */

// API reference: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api

const DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || '';
const DOCUMENT_INTELLIGENCE_API_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY || '';

interface DocumentContent {
  content: string;
  metadata: {
    source: string;
    fileType?: string;
    fileName?: string;
    fileSize?: number;
    lastModified?: string;
  };
}

/**
 * Analyzes document content from a file
 * @param fileSource URL of the file to analyze or ArrayBuffer with file content
 * @param fileName Name of the file
 * @param fileType MIME type of the file
 * @param fileSize Size of the file in bytes
 * @param lastModified Last modified date of the file
 * @returns Document content and metadata
 */
export async function analyzeDocument(
  fileSource: string | ArrayBuffer,
  fileName: string,
  fileType?: string,
  fileSize?: number,
  lastModified?: string
): Promise<DocumentContent> {
  try {
    // Validate required parameters
    if (!DOCUMENT_INTELLIGENCE_ENDPOINT || !DOCUMENT_INTELLIGENCE_API_KEY) {
      throw new Error('Azure Document Intelligence API credentials are not configured');
    }

    // Get the file extension to determine the model to use
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    console.log(`File extension: ${fileExtension}`);
    
    // Get the file content
    let fileBuffer: ArrayBuffer;
    
    if (typeof fileSource === 'string') {
      // If fileSource is a URL, fetch the file
      console.log(`Fetching file from URL: ${fileSource}`);
      const fileResponse = await fetch(fileSource);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
      }
      fileBuffer = await fileResponse.arrayBuffer();
    } else {
      // If fileSource is already an ArrayBuffer, use it directly
      console.log(`Using provided file buffer (${fileSource.byteLength} bytes)`);
      fileBuffer = fileSource;
    }
    
    // Check if file is empty
    if (!fileBuffer || fileBuffer.byteLength === 0) {
      throw new Error('File content is empty');
    }
    
    console.log(`Processing file with ${fileBuffer.byteLength} bytes`);
    
    // Determine models to try based on file extension
    const modelsToTry: string[] = [];
    
    // Office documents often need specific models
    if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(fileExtension)) {
      // For Office documents, try document model first, then read, then layout as fallback
      modelsToTry.push('prebuilt-document', 'prebuilt-read', 'prebuilt-layout');
    } else if (['pdf'].includes(fileExtension)) {
      // For PDFs, layout works best but try document as fallback
      modelsToTry.push('prebuilt-layout', 'prebuilt-document');
    } else {
      // For other files, try layout first then document
      modelsToTry.push('prebuilt-layout', 'prebuilt-document');
    }
    
    // Store errors for diagnosis
    const errors: string[] = [];
    
    // Try each model in sequence until one works
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting to process with model: ${modelName}`);
        
        // Prepare the request
        const analyzeEndpoint = `${DOCUMENT_INTELLIGENCE_ENDPOINT}formrecognizer/documentModels/${modelName}:analyze?api-version=2023-07-31`;
        console.log(`Using Document Intelligence endpoint: ${analyzeEndpoint}`);
        
        // Call Azure Document Intelligence API
        const response = await fetch(analyzeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': fileType || 'application/octet-stream',
            'Ocp-Apim-Subscription-Key': DOCUMENT_INTELLIGENCE_API_KEY
          },
          body: fileBuffer,
          // @ts-ignore -- duplex is required in Node.js 18+ but not in TypeScript definitions
          duplex: 'half'
        });

        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorJson = JSON.parse(errorText);
            const errorMessage = errorJson.error?.message || 'Unknown error';
            const innerError = errorJson.error?.innererror?.message || '';
            
            // Store this error and continue to next model
            errors.push(`Model ${modelName} failed: ${errorMessage} - ${innerError}`);
            continue;
          } catch (parseError) {
            errors.push(`Model ${modelName} failed with unparseable error: ${errorText}`);
            continue;
          }
        }

        // Get operation location for polling result
        const operationLocation = response.headers.get('Operation-Location');
        if (!operationLocation) {
          errors.push(`Model ${modelName} failed: Operation-Location header not found`);
          continue;
        }

        // Poll for the result
        const result = await pollForResult(operationLocation);

        // Extract text content from the result
        const content = extractTextFromResult(result);
        
        // If content is empty but the API didn't throw an error, try next model
        if (!content.trim()) {
          console.warn(`Warning: Model ${modelName} returned empty content for ${fileName}`);
          errors.push(`Model ${modelName} returned empty content`);
          continue;
        }

        // If we got here, we have success
        console.log(`Successfully extracted content with model ${modelName}: ${content.length} characters`);
        return {
          content,
          metadata: {
            source: fileName,
            fileType,
            fileName,
            fileSize,
            lastModified
          }
        };
      } catch (modelError: any) {
        // Store error and continue to next model
        errors.push(`Model ${modelName} failed with error: ${modelError.message}`);
        console.warn(`Failed with model ${modelName}: ${modelError.message}`);
        continue;
      }
    }

    // If we get here, all models failed
    // Check if the document might be protected/labeled based on error messages
    if (errors.some(e => e.includes('corrupted') || e.includes('unsupported') || e.includes('Invalid'))) {
      const errorMessage = `Document may be protected or have security labels. Please try a document without protection. Tried models: ${modelsToTry.join(', ')}. Errors: ${errors.join(' | ')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Otherwise throw generic error with all attempts
    throw new Error(`Failed to process document with any model. Tried: ${modelsToTry.join(', ')}. Errors: ${errors.join(' | ')}`);
    
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

/**
 * Polls the Document Intelligence API for the result of the analysis
 * @param operationLocation URL to poll for the result
 * @returns Analysis result
 */
async function pollForResult(operationLocation: string): Promise<any> {
  const maxRetries = 10;
  const pollingIntervalMs = 1000;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    const response = await fetch(operationLocation, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': DOCUMENT_INTELLIGENCE_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error polling for result: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.status === 'succeeded') {
      return result;
    } else if (result.status === 'failed') {
      throw new Error(`Document analysis failed: ${JSON.stringify(result.error)}`);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
  }

  throw new Error('Document analysis timed out');
}

/**
 * Extracts text content from the Document Intelligence analysis result
 * @param result Analysis result from Document Intelligence
 * @returns Extracted text content
 */
function extractTextFromResult(result: any): string {
  try {
    const content: string[] = [];
    
    // Extract text from pages
    if (result.analyzeResult && result.analyzeResult.pages) {
      for (const page of result.analyzeResult.pages) {
        if (page.lines) {
          for (const line of page.lines) {
            if (line.content) {
              content.push(line.content);
            }
          }
        }
      }
    }
    
    // Extract text from paragraphs if available
    if (result.analyzeResult && result.analyzeResult.paragraphs) {
      for (const paragraph of result.analyzeResult.paragraphs) {
        if (paragraph.content) {
          content.push(paragraph.content);
        }
      }
    }
    
    return content.join('\n');
  } catch (error) {
    console.error('Error extracting text from result:', error);
    return 'Error extracting text content from document';
  }
} 