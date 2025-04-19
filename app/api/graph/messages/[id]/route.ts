import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getGraphClient } from "@/lib/microsoft-graph";
import { getValidAccessToken } from "@/lib/server-actions";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id;
    if (!messageId) {
      return NextResponse.json(
        { error: "Missing message ID" },
        { status: 400 }
      );
    }

    // Get search parameters for options
    const searchParams = new URL(request.url).searchParams;
    const expandBody = searchParams.has("$expand") || searchParams.has("expandBody") || searchParams.has("includeFullBody");
    
    console.log(`Graph API - Fetching message ID: ${messageId}, expandBody: ${expandBody}`);

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
    
    // Prepare API request
    let apiRequest = graphClient.api(`/me/messages/${messageId}`);
    
    // Add select parameters - always include basic fields
    apiRequest = apiRequest.select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,attachments");
    
    // Add body expansion if requested
    if (expandBody) {
      apiRequest = apiRequest.expand("body");
    }
    
    // Execute the request
    const response = await apiRequest.get();
    
    if (!response) {
      console.error("No response received from Graph API");
      return NextResponse.json(
        { error: "Failed to retrieve message" },
        { status: 500 }
      );
    }
    
    console.log(`Graph API - Retrieved message: ${response.subject || 'No subject'}`);
    console.log(`Body status: ${!!response.body ? 'Included' : 'Not included'}`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching message:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 }
    );
  }
} 