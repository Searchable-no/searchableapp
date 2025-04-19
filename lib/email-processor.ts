/**
 * Email processing utility for extracting content from emails
 */

import { Microsoft365Resource } from "@/components/ai-services/ResourcePicker";

/**
 * Helper function to clean and encode an email ID for API requests
 * Microsoft Graph API sometimes has issues with certain email ID formats
 */
function sanitizeEmailId(emailId: string): string {
  // Replace potentially problematic characters in the email ID
  return emailId.replace(/[\/\+\=]/g, '_');
}

/**
 * Normalizes the email content based on different formats that might be returned 
 * from different APIs
 */
function normalizeEmailContent(email: any): any {
  if (!email) return null;

  // If the email is already in the expected format, return it as is
  if (email.body && email.body.content) {
    return email;
  }

  // Microsoft Graph API format with body.content
  if (email.body && typeof email.body === 'object') {
    return email;
  }

  // If email has content directly (from another API)
  if (email.content) {
    return {
      ...email,
      body: { content: email.content }
    };
  }

  // Handle case where content might be in a different property
  if (email.bodyPreview) {
    return {
      ...email,
      body: { content: email.bodyPreview }
    };
  }

  // If no content is found anywhere, return the original object
  // but with an empty body.content to prevent errors
  return {
    ...email,
    body: { content: '' }
  };
}

/**
 * Creates rich fallback content when full email body isn't available
 */
function createRichFallbackContent(emailData: any): string {
  // Create a fallback content string from available email metadata
  const from = emailData.from?.emailAddress?.name || emailData.from?.emailAddress?.address || 'Unknown Sender';
  const subject = emailData.subject || 'No Subject';
  const receivedDate = emailData.receivedDateTime 
    ? new Date(emailData.receivedDateTime).toLocaleString() 
    : 'Unknown Date';
  
  return `
    From: ${from}
    Subject: ${subject}
    Date: ${receivedDate}
    
    [Unable to retrieve full email content. This is a preview generated from metadata.]
  `;
}

/**
 * Normalizes an email resource to ensure consistent structure
 */
function normalizeEmailResource(email: Microsoft365Resource): Microsoft365Resource {
  // Ensure all required fields exist in the Microsoft365Resource
  return {
    id: email.id,
    name: email.name || email.subject || 'Untitled Email',
    type: 'email',
    from: email.from,
    receivedDateTime: email.receivedDateTime,
    subject: email.subject,
    webUrl: email.webUrl,
    content: email.content || '',
    preview: email.preview || ''
  };
}

/**
 * Processes an email to extract and format its content
 * @param resource The email resource to process
 * @returns The email with extracted content
 */
async function processEmailContent(resource: Microsoft365Resource): Promise<Microsoft365Resource> {
  // Skip processing if it's not an email type
  if (resource.type !== 'email') {
    console.log(`Skipping resource of type: ${resource.type}`);
    return resource;
  }
  
  console.log(`--- Processing email content ---`);
  console.log(`ID: ${resource.id}`);
  console.log(`Subject: ${resource.subject || 'No subject'}`);
  console.log(`From: ${resource.from?.emailAddress?.name || resource.from?.emailAddress?.address || 'Unknown'}`);
  
  // Email ID
  const emailId = resource.id;
  
  try {
    // First, try to get the email content using GET request
    let response = await fetch(`/api/emails/message?id=${encodeURIComponent(emailId)}`);
    console.log(`Email API GET response status: ${response.status}`);
    
    // If GET fails, try using POST which has more robust error handling
    if (!response.ok) {
      console.log('GET request failed, trying POST fallback...');
      
      // Build payload with all available metadata to help find the email
      const payload = {
        id: emailId,
        subject: resource.subject,
        from: resource.from?.emailAddress?.name || resource.from?.emailAddress?.address
      };
      
      response = await fetch('/api/emails/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      console.log(`Email API POST response status: ${response.status}`);
    }
    
    if (!response.ok) {
      // If both attempts fail, log the error and use fallback content
      console.error(`Failed to fetch email content: ${response.status} ${response.statusText}`);
      
      // Create fallback content and preview from available metadata
      const fallbackContent = createRichFallbackContent(resource);
      const preview = stripHtmlTags(fallbackContent).substring(0, 150) + '...';
      
      // Return a properly formatted Microsoft365Resource with fallback content
      return {
        ...resource,
        type: 'email',
        content: fallbackContent,
        preview: preview
      };
    }
    
    // Parse the API response
    const emailData = await response.json();
    if (emailData.error) {
      console.error(`API returned error: ${emailData.error}`);
      throw new Error(emailData.error);
    }
    
    console.log(`Email API response successful`);
    console.log(`Email subject: ${emailData.subject || 'No subject'}`);
    console.log(`Email content type: ${emailData.body?.contentType || 'unknown'}`);
    console.log(`Email content length: ${emailData.body?.content?.length || 0} characters`);
    
    // Normalize the email data to ensure consistent structure
    const normalizedEmail = normalizeEmailContent(emailData);
    if (!normalizedEmail || !normalizedEmail.body) {
      console.error(`Failed to normalize email data`);
      throw new Error('Email data could not be normalized');
    }
    
    // Extract and sanitize HTML content
    const emailBody = normalizedEmail.body.content || '';
    console.log(`Extracted email body length: ${emailBody.length} characters`);
    
    if (!emailBody) {
      console.warn(`Email body is empty after normalization`);
    }
    
    const strippedTextContent = stripHtmlTags(emailBody);
    console.log(`Stripped text content length: ${strippedTextContent.length} characters`);
    
    // Format the email content with metadata
    const formattedContent = formatEmailContent(resource, emailBody);
    
    // Create a preview (first 150 characters)
    const preview = strippedTextContent.substring(0, 150) + (strippedTextContent.length > 150 ? '...' : '');
    
    // Return the fully processed email as Microsoft365Resource
    return normalizeEmailResource({
      ...resource,
      type: 'email',
      content: formattedContent,
      preview: preview
    });
  } catch (error) {
    console.error(`Error processing email content:`, error);
    console.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
    
    // Create fallback content for error cases
    const fallbackContent = createRichFallbackContent(resource);
    const preview = stripHtmlTags(fallbackContent).substring(0, 150) + '...';
    
    // Return with fallback content
    return {
      ...resource,
      type: 'email',
      content: fallbackContent,
      preview: preview
    };
  }
}

/**
 * Formats the email content with metadata
 */
function formatEmailContent(email: Microsoft365Resource, content: string): string {
  if (!content) {
    console.warn('No content provided to formatEmailContent');
  }
  
  // Extract sender information with fallbacks
  const senderName = email.from?.emailAddress?.name || 
                    email.from?.emailAddress?.address || 
                    (email.from as any)?.name ||
                    (email.from as any)?.email ||
                    'Unknown Sender';
  
  const senderEmail = email.from?.emailAddress?.address || 
                     (email.from as any)?.email ||
                     '';
  
  // Format received date with fallback
  const receivedDate = email.receivedDateTime 
    ? new Date(email.receivedDateTime).toLocaleString() 
    : 'Unknown Date';
  
  // Add email metadata at the top of the content
  const metadata = `
    <div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
      <div><strong>From:</strong> ${senderName} ${senderEmail ? `<${senderEmail}>` : ''}</div>
      <div><strong>Subject:</strong> ${email.subject || email.name || 'No Subject'}</div>
      <div><strong>Date:</strong> ${receivedDate}</div>
    </div>
  `;
  
  // Ensure content is a string
  const safeContent = content || '[No content available]';
  
  return metadata + safeContent;
}

/**
 * Strip HTML tags from content with improved handling of email formatting
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // Replace links with text and URL
  html = html.replace(/<a[^>]*href\s*=\s*["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 [$1]');
  
  // First, replace common HTML entities
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…');
  
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Clean up whitespace
  text = text
    .replace(/\n\s*\n\s*\n+/g, '\n\n')  // Replace 3+ newlines with just 2
    .replace(/[ \t]+/g, ' ')            // Replace multiple spaces/tabs with single space
    .trim();                             // Remove leading/trailing whitespace
    
  return text;
}

export { processEmailContent }; 