import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/users/direct-lookup?email=user@example.com
// Find a user directly in auth.users by email using a workaround
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  
  if (!email) {
    return NextResponse.json({
      error: "Email parameter is required"
    }, { status: 400 });
  }
  
  try {
    // Check authentication
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.log(`Direct lookup for user with email: ${email}`);
    
    // This attempt uses a raw SQL query through the postgrest API
    // It's a workaround that may or may not work depending on permissions
    try {
      const { data: rawResult, error: rawError } = await supabase.rpc(
        'query_user_by_email_workaround',
        { email_to_find: email }
      );
      
      if (!rawError && rawResult) {
        console.log("Found user through raw query:", rawResult);
        return NextResponse.json({
          user: {
            id: rawResult.id,
            email: rawResult.email,
            display_name: rawResult.email.split('@')[0],
            avatar_url: null
          }
        });
      }
    } catch (rawQueryError) {
      console.warn("Raw query failed:", rawQueryError);
    }
    
    // Last attempt - try to use a SQL function if available
    try {
      const { data: functionResult, error: functionError } = await supabase.rpc(
        'find_user_by_email',
        { email_param: email }
      );
      
      if (!functionError && functionResult) {
        console.log("Found user via SQL function:", functionResult);
        return NextResponse.json({
          user: functionResult
        });
      }
    } catch (functionError) {
      console.warn("Function call failed:", functionError);
    }
    
    // If we get here, we couldn't find the user
    return NextResponse.json({
      message: "User not found or inaccessible",
      user: null
    });
  } catch (error) {
    console.error("Error in direct lookup:", error);
    return NextResponse.json(
      { error: "Failed to perform direct lookup" },
      { status: 500 }
    );
  }
} 