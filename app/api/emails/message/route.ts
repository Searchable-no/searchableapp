import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getGraphClient } from "@/lib/microsoft-graph";
import { getValidAccessToken } from "@/lib/server-actions";

export async function GET(request: NextRequest) {
  try {
    // Get the ID parameter from the query
    const searchParams = new URL(request.url).searchParams;
    const messageId = searchParams.get("id");
    
    if (!messageId) {
      return NextResponse.json(
        { error: "Missing message ID parameter" },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving email with ID: ${messageId}`);

    // Get the authenticated user using Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get the user ID from the database
    const { data: userData, error: userDbError } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .single();

    if (userDbError || !userData) {
      console.error("User DB error:", userDbError);
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }
    
    // Get access token using the user ID
    const accessToken = await getValidAccessToken(userData.id);
    const graphClient = await getGraphClient(accessToken);
    
    try {
      // Try to find the email by searching with criteria rather than direct ID access
      let email = null;
      
      // Get a more reliable identifier - the Internet Message ID if available
      const messageIdParam = messageId;
      
      try {
        // Method 3: Search by recent emails and match the one we need
        console.log("Trying to find email by searching recent emails");
        const searchResponse = await graphClient
          .api("/me/messages")
          .select("id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,attachments")
          .top(20) // Retrieve last 20 emails
          .orderby("receivedDateTime desc")
          .get();
          
        if (searchResponse?.value && searchResponse.value.length > 0) {
          // Look for the message with the matching ID
          console.log(`Looking for email with ID ending with: ${messageIdParam.slice(-20)}`);
          email = searchResponse.value.find((msg: any) => 
            msg.id === messageIdParam || 
            msg.id.endsWith(messageIdParam.slice(-20)) // Match by the last part of ID
          );
          
          if (email) {
            console.log(`Found email by searching through recent messages: "${email.subject}"`);
          } else {
            console.log("Could not find matching email in recent messages");
          }
        }
      } catch (searchError) {
        console.error("Search method failed:", searchError);
      }
      
      if (!email) {
        return NextResponse.json(
          { error: "Email not found or could not be accessed" },
          { status: 404 }
        );
      }
      
      console.log(`Email retrieved successfully: ${email.subject || 'No subject'}`);
      console.log(`Email body status: ${!!email.body ? 'Available' : 'Not available'}`);
      
      return NextResponse.json(email);
    } catch (graphError: any) {
      console.error("Graph API error:", graphError);
      
      // Return appropriate error based on status code
      if (graphError.statusCode === 404) {
        return NextResponse.json(
          { error: "Email not found" },
          { status: 404 }
        );
      } else if (graphError.statusCode === 401 || graphError.statusCode === 403) {
        return NextResponse.json(
          { error: "Unauthorized access to email" },
          { status: graphError.statusCode }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to retrieve email from Microsoft Graph" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email message API:", error);
    return NextResponse.json(
      { error: "Server error retrieving email" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for fetching an email by ID
 * This avoids URL encoding issues with complex email IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the email ID
    const body = await request.json();
    const messageId = body.id;
    const subject = body.subject;
    const fromEmailOrName = body.from;
    
    if (!messageId) {
      return NextResponse.json(
        { error: "Missing message ID in request body" },
        { status: 400 }
      );
    }
    
    console.log(`Retrieving email with ID (POST method): ${messageId}`);
    if (subject) console.log(`Backup search params - Subject: ${subject}`);
    if (fromEmailOrName) console.log(`Backup search params - From: ${fromEmailOrName}`);

    // Get the authenticated user using Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get the user ID from the database
    const { data: userData, error: userDbError } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .single();

    if (userDbError || !userData) {
      console.error("User DB error:", userDbError);
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }
    
    // Get access token using the user ID
    const accessToken = await getValidAccessToken(userData.id);
    const graphClient = await getGraphClient(accessToken);
    
    try {
      // Try to find the email by searching with criteria rather than direct ID access
      let email = null;
      
      // Get a more reliable identifier - the Internet Message ID if available
      const messageIdParam = messageId;
      
      try {
        // Method 1: Direct access by ID (may fail for complex IDs)
        console.log("Trying to access email directly by ID");
        try {
          email = await graphClient
            .api(`/me/messages/${messageIdParam}`)
            .select("id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,attachments")
            .get();
            
          if (email) {
            console.log(`Found email directly by ID: "${email.subject}"`);
          }
        } catch (directAccessError) {
          console.log("Direct ID access failed:", directAccessError instanceof Error ? directAccessError.message : String(directAccessError));
        }
        
        // Method 2: Search by subject and from if we have them
        if (!email && subject) {
          console.log("Trying to find email by subject and sender");
          
          // Build filter based on what we have
          let filter = `subject eq '${subject.replace(/'/g, "''")}'`; // Escape single quotes for OData
          
          // If we have sender info, add that to the filter
          if (fromEmailOrName) {
            // Try to match either display name or email address in from field
            filter += ` and (contains(from/emailAddress/name,'${fromEmailOrName.replace(/'/g, "''")}') or contains(from/emailAddress/address,'${fromEmailOrName.replace(/'/g, "''")}'))`;
          }
          
          console.log(`Searching with filter: ${filter}`);
          
          const searchByPropsResponse = await graphClient
            .api("/me/messages")
            .filter(filter)
            .select("id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,attachments")
            .top(5) // Limit to 5 emails that match
            .get();
            
          if (searchByPropsResponse?.value && searchByPropsResponse.value.length > 0) {
            // Use the first matching email
            email = searchByPropsResponse.value[0];
            console.log(`Found email by subject/sender: "${email.subject}"`);
          }
        }
        
        // Method 3: Search by recent emails and match the one we need
        if (!email) {
          console.log("Trying to find email by searching recent emails");
          const searchResponse = await graphClient
            .api("/me/messages")
            .select("id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,attachments")
            .top(20) // Retrieve last 20 emails
            .orderby("receivedDateTime desc")
            .get();
            
          if (searchResponse?.value && searchResponse.value.length > 0) {
            // Look for the message with the matching ID
            console.log(`Looking for email with ID ending with: ${messageIdParam.slice(-20)}`);
            email = searchResponse.value.find((msg: any) => 
              msg.id === messageIdParam || 
              msg.id.endsWith(messageIdParam.slice(-20)) // Match by the last part of ID
            );
            
            // If no match by ID but we have subject, try to match by subject
            if (!email && subject) {
              console.log(`Looking for email with subject: "${subject}"`);
              email = searchResponse.value.find((msg: any) => 
                msg.subject === subject && 
                (!fromEmailOrName || 
                  (msg.from?.emailAddress?.name && msg.from.emailAddress.name.includes(fromEmailOrName)) ||
                  (msg.from?.emailAddress?.address && msg.from.emailAddress.address.includes(fromEmailOrName))
                )
              );
            }
            
            if (email) {
              console.log(`Found email by searching through recent messages: "${email.subject}"`);
            } else {
              console.log("Could not find matching email in recent messages");
            }
          }
        }
      } catch (searchError) {
        console.error("Search method failed:", searchError);
      }
      
      if (!email) {
        return NextResponse.json(
          { error: "Email not found or could not be accessed" },
          { status: 404 }
        );
      }
      
      console.log(`Email retrieved successfully: ${email.subject || 'No subject'}`);
      console.log(`Email body status: ${!!email.body ? 'Available' : 'Not available'}`);
      
      return NextResponse.json(email);
    } catch (graphError: any) {
      console.error("Graph API error:", graphError);
      
      // Return appropriate error based on status code
      if (graphError.statusCode === 404) {
        return NextResponse.json(
          { error: "Email not found" },
          { status: 404 }
        );
      } else if (graphError.statusCode === 401 || graphError.statusCode === 403) {
        return NextResponse.json(
          { error: "Unauthorized access to email" },
          { status: graphError.statusCode }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to retrieve email from Microsoft Graph" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email message API (POST):", error);
    return NextResponse.json(
      { error: "Server error retrieving email" },
      { status: 500 }
    );
  }
} 