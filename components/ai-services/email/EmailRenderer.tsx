"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { EmailMessage } from "@/lib/microsoft-graph";

// CSS for the iframe content
const iframeStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }
  
  img {
    max-width: 100%;
    height: auto;
  }
  
  a {
    color: #3b82f6;
    text-decoration: underline;
  }
  
  blockquote {
    border-left: 3px solid #e5e7eb;
    padding-left: 1rem;
    margin-left: 0;
    color: #6b7280;
  }
  
  pre {
    background-color: #f3f4f6;
    padding: 0.75rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1rem;
  }
  
  table td, table th {
    border: 1px solid #e5e7eb;
    padding: 0.5rem;
  }
  
  p {
    margin: 0 0 1em 0;
  }
  
  ul, ol {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
  
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    font-weight: 600;
    line-height: 1.25;
  }
  
  /* Common email client specific fixes */
  
  /* Outlook */
  .ExternalClass {
    width: 100%;
  }
  
  .ExternalClass, .ExternalClass p, .ExternalClass span, 
  .ExternalClass font, .ExternalClass td, .ExternalClass div {
    line-height: 100%;
  }
  
  /* Fix for quoted content */
  .gmail_quote {
    border-left: 1px solid #ccc;
    padding-left: 12px;
    color: #666;
  }
  
  /* Outlook spacing */
  div[style*="margin: 16px 0"] { 
    margin: 0 !important; 
  }
  
  /* Common outlook nested list fix */
  .outlook-nested-list {
    padding-left: 20px !important;
  }
  
  /* Fix for blue links in Outlook */
  span.MsoHyperlink {
    color: #3b82f6 !important;
  }
`;

interface EmailRendererProps {
  email: EmailMessage;
  className?: string;
}

export default function EmailRenderer({
  email,
  className = "",
}: EmailRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getFullEmailContent = (email: EmailMessage): string => {
    if (!email) return "<p>No email content available</p>";

    // First try the body content which should contain the full HTML
    if (email.body?.content && email.body.content.trim().length > 0) {
      return email.body.content;
    }

    // If no body content, try bodyPreview
    if (email.bodyPreview && email.bodyPreview.trim().length > 0) {
      return `<p>${email.bodyPreview}</p>`;
    }

    return "<p>No content available</p>";
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      // Get content and sanitize it
      const htmlContent = getFullEmailContent(email);
      const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target", "class"], // Allow target attribute for links and class
        FORBID_TAGS: ["script", "iframe", "object", "embed"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
      });

      // Access the iframe document
      const iframeDocument =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) return;

      // Create a HTML document with proper structure
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${iframeStyles}</style>
          </head>
          <body>
            ${sanitizedHtml}
          </body>
        </html>
      `;

      // Write content to iframe
      iframeDocument.open();
      iframeDocument.write(fullHtml);
      iframeDocument.close();

      // Adjust iframe height to content after it's loaded
      const resizeObserver = new ResizeObserver(() => {
        if (iframe && iframeDocument.body) {
          // Add some padding to avoid scrollbars
          iframe.style.height = `${iframeDocument.body.scrollHeight + 20}px`;
        }
      });

      // Observe the body for size changes
      if (iframeDocument.body) {
        resizeObserver.observe(iframeDocument.body);
      }

      // Add click event listener to handle links
      iframeDocument.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const link = target.closest("a");

        if (link && link.href) {
          e.preventDefault();
          window.open(link.href, "_blank");
        }
      });

      // Clean up
      return () => {
        if (iframeDocument.body) {
          resizeObserver.unobserve(iframeDocument.body);
        }
        resizeObserver.disconnect();
      };
    } catch (error) {
      console.error("Error rendering email content:", error);
    }
  }, [email]);

  return (
    <div className={`email-renderer ${className}`}>
      <iframe
        ref={iframeRef}
        className="w-full border-0 bg-transparent"
        style={{ minHeight: "150px" }}
        title={`Email from ${email?.from?.emailAddress?.name || "sender"}`}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
