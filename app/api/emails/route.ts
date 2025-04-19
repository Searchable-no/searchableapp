import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getGraphClient } from "@/lib/microsoft-graph";
import { getValidAccessToken } from "@/lib/server-actions";

export async function GET(request: NextRequest) {
  try {
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
    
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;
    
    console.log(`Fetching emails with page=${page}, limit=${limit}, skip=${skip}`);
    
    // Get access token using the user ID
    const accessToken = await getValidAccessToken(userData.id);
    const graphClient = await getGraphClient(accessToken);
    
    // Fetch emails with pagination
    const response = await graphClient
      .api("/me/mailFolders/inbox/messages")
      .select("id,subject,from,receivedDateTime,bodyPreview,webLink,isRead,conversationId")
      .filter("isDraft eq false")
      .skip(skip)
      .top(limit)
      .orderby("receivedDateTime DESC")
      .get();
    
    console.log(`API: Fetched ${response?.value?.length || 0} additional emails`);
    
    return NextResponse.json({ emails: response.value });
  } catch (error) {
    console.error("Error fetching more emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
} 