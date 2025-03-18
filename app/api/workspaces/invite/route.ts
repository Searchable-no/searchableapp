import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// POST /api/workspaces/invite
// Send an invitation to a workspace
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await request.json();
  const { workspaceId, email } = body;

  if (!workspaceId || !email) {
    return NextResponse.json(
      { error: "Workspace ID and email are required" },
      { status: 400 }
    );
  }

  try {
    // Get current user's ID (the one sending the invitation)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get workspace details for the invitation
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    // Check if the recipient has a real user account
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("is_placeholder")
      .eq("email", email)
      .single();

    const isPlaceholderUser = userProfile?.is_placeholder === true;

    // In a real implementation, this would send an email with:
    // 1. Info about who invited them
    // 2. The workspace they're invited to
    // 3. A link to accept the invitation
    
    console.log(`[DEV] Sending invitation to ${email} for workspace "${workspace.name}"`);
    console.log(`[DEV] Invitation is for a ${isPlaceholderUser ? 'new' : 'existing'} user`);

    // For development, we're just returning success
    return NextResponse.json({
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Error sending invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
} 