"use client";

import React, { useMemo } from "react";
import DOMPurify from "dompurify";
import { EmailMessage } from "@/lib/microsoft-graph";

// Base styles for email content - keeping it minimal to preserve original layouts
const emailStyles = `
  .email-content {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
  }
  
  .email-content img {
    max-width: 100%;
    height: auto;
  }
  
  .email-content a {
    color: #3b82f6;
    text-decoration: underline;
  }
  
  .email-content blockquote {
    border-left: 3px solid #e5e7eb;
    padding-left: 1rem;
    margin-left: 0;
    color: #6b7280;
  }
  
  /* Fix for Gmail quoted content */
  .email-content .gmail_quote {
    border-left: 1px solid #ccc;
    padding-left: 12px;
    color: #666;
  }

  /* Fix for Outlook specific elements */
  .email-content .MsoNormal {
    margin: 0 !important;
  }
  
  /* Specific fixes for Asana emails */
  .email-content [class*="asana"],
  .email-content [id*="asana"],
  .email-content [class*="task"],
  .email-content [id*="task"] {
    display: initial !important;
  }
  
  /* Preserve checkbox appearance */
  .email-content input[type="checkbox"] {
    display: inline-block !important;
    width: auto !important;
    margin-right: 5px !important;
  }
  
  /* Preserve task list styles */
  .email-content td img[width="15"],
  .email-content td img[width="16"],
  .email-content td img[width="14"] {
    vertical-align: middle;
    display: inline-block !important;
  }
  
  /* Make Asana emails display better */
  .asana-email img {
    display: inline-block;
  }
  
  .asana-email table {
    width: auto !important;
    max-width: 100%;
  }
  
  .asana-email [style*="width:"] {
    max-width: 100%;
  }
  
  /* Only add padding for mobile */
  @media (max-width: 640px) {
    .email-content {
      padding: 0 10px;
    }
  }
`;

interface EmailRendererProps {
  email: EmailMessage;
  className?: string;
}

const EmailRenderer: React.FC<EmailRendererProps> = ({
  email,
  className = "",
}) => {
  // Process email content with HTML transformations for better rendering
  const processedContent = useMemo(() => {
    try {
      // Get content from email body or fallback to preview
      let content = "";

      if (email.body?.content) {
        content = email.body.content;
      } else if (email.bodyPreview) {
        // Format preview as proper HTML if it's plain text
        content = `<div style="white-space: pre-wrap;">${email.bodyPreview}</div>`;
      } else {
        return "";
      }

      // Check if content is plain text
      if (
        email.body?.contentType === "text" ||
        (!content.includes("<") && !content.includes(">"))
      ) {
        content = `<div style="white-space: pre-wrap;">${content}</div>`;
        return content;
      }

      // Check if this is a known email format we should preserve
      const isSpecialFormat =
        content.includes("asana.com") ||
        email.from?.emailAddress?.address?.includes("asana") ||
        content.includes("task") ||
        content.includes("searchable.no") ||
        content.includes("background-color:");

      if (isSpecialFormat) {
        // For Asana and other well-structured emails, preserve the layout
        return content;
      }

      // Process HTML for basic display improvements, if needed
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;

      // Only make images responsive, avoid other transformations
      const images = tempDiv.querySelectorAll("img");
      images.forEach((img) => {
        if (
          !img.hasAttribute("width") ||
          parseInt(img.getAttribute("width") || "0", 10) > 600
        ) {
          (img as HTMLImageElement).style.maxWidth = "100%";
        }
        if (img.hasAttribute("height")) {
          (img as HTMLImageElement).style.height = "auto";
        }
      });

      return tempDiv.innerHTML;
    } catch (error) {
      console.error("Error processing email content:", error);
      return email.bodyPreview || "Error displaying email content";
    }
  }, [email]);

  // Configure DOMPurify for email content
  const sanitizeConfig = {
    ADD_TAGS: ["style", "input", "iframe"],
    ADD_ATTR: [
      "target",
      "style",
      "width",
      "height",
      "align",
      "valign",
      "class",
      "type",
      "checked",
      "src",
      "alt",
      "border",
      "cellpadding",
      "cellspacing",
      "bgcolor",
      "background",
      "frameborder",
      "role",
      "aria-label",
    ],
    ALLOW_DATA_ATTR: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    FORBID_TAGS: ["script", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  };

  // Sanitize the HTML content
  const sanitizedHtml = DOMPurify.sanitize(processedContent, sanitizeConfig);

  // Determine if this is an Asana email to add special handling
  const isAsanaEmail =
    email.from?.emailAddress?.address?.includes("asana") ||
    sanitizedHtml.includes("asana.com");

  return (
    <>
      <style jsx global>
        {emailStyles}
      </style>
      <div
        className={`email-content ${className} ${isAsanaEmail ? "asana-email" : ""}`}
      >
        <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      </div>
    </>
  );
};

export default EmailRenderer;
