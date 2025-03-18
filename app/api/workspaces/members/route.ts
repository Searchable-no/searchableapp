import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/workspaces/members?workspaceId=<id>
// Fetch members of a workspace
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace ID is required" },
      { status: 400 }
    );
  }

  try {
    // First, check if the workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    // Get the workspace owner's profile
    let ownerProfile = null;
    try {
      const { data: profile, error: ownerProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", workspace.user_id)
        .single();
        
      if (!ownerProfileError) {
        ownerProfile = profile;
      } else {
        console.error("Error fetching owner profile:", ownerProfileError);
      }
    } catch (err) {
      console.error("Exception fetching owner profile:", err);
    }

    // Then get all members of the workspace
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (membersError) {
      throw membersError;
    }

    // Get profiles for all members
    const memberProfiles = [];
    if (members && members.length > 0) {
      for (const member of members) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", member.user_id)
            .single();
            
          memberProfiles.push({
            ...member,
            profile: profile || { 
              email: "unknown@example.com", 
              display_name: "Unknown User" 
            }
          });
        } catch {
          // If profile fetch fails, still add the member with a placeholder profile
          memberProfiles.push({
            ...member,
            profile: { 
              email: "unknown@example.com", 
              display_name: "Unknown User" 
            }
          });
        }
      }
    }

    // Return workspace owner and members
    return NextResponse.json({
      owner: {
        user_id: workspace.user_id,
        role: "owner",
        email: ownerProfile?.email || "Unknown Email",
        display_name: ownerProfile?.display_name || "Workspace Owner",
        avatar_url: ownerProfile?.avatar_url || null,
      },
      members: memberProfiles || [],
    });
  } catch (error) {
    console.error("Error fetching workspace members:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace members" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/members
// Add a new member to a workspace
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await request.json();
  const { workspaceId, email, role } = body;

  if (!workspaceId || !email || !role) {
    return NextResponse.json(
      { error: "Workspace ID, email, and role are required" },
      { status: 400 }
    );
  }

  if (!["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be 'viewer', 'editor', or 'admin'" },
      { status: 400 }
    );
  }

  try {
    // Get current user's ID (the one adding the member)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // First try to find the user in auth.users (requires admin rights)
    let userToAdd = null;
    
    // Try to find the user by email in the profiles table
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (!profileError && existingProfile) {
      userToAdd = {
        id: existingProfile.id, 
        email: existingProfile.email,
        display_name: existingProfile.display_name,
        avatar_url: existingProfile.avatar_url
      };
      console.log("Found user in profiles table:", userToAdd.id);
    } else {
      console.log("Profile not found directly, trying SQL functions");
      
      // Try using the SQL function to find the user
      try {
        const { data: functionResult, error: functionError } = await supabase.rpc(
          'find_user_by_email',
          { email_param: email }
        );
        
        if (!functionError && functionResult) {
          console.log("User found via SQL function:", functionResult.id);
          userToAdd = functionResult;
        }
      } catch (functionError) {
        console.warn("SQL function lookup failed:", functionError);
      }
      
      // If still not found, try the alternate function
      if (!userToAdd) {
        try {
          const { data: alternateResult, error: alternateError } = await supabase.rpc(
            'query_user_by_email_workaround',
            { email_to_find: email }
          );
          
          if (!alternateError && alternateResult) {
            console.log("User found via alternate SQL function:", alternateResult.id);
            userToAdd = {
              id: alternateResult.id,
              email: alternateResult.email,
              display_name: alternateResult.email.split('@')[0],
              avatar_url: null
            };
          }
        } catch (alternateError) {
          console.warn("Alternate function lookup failed:", alternateError);
        }
      }
      
      // Try the direct lookup API
      if (!userToAdd) {
        try {
          console.log("Trying direct lookup API");
          const directResponse = await fetch(`${request.nextUrl.origin}/api/users/direct-lookup?email=${encodeURIComponent(email)}`);
          const directData = await directResponse.json();
          
          if (directResponse.ok && directData.user) {
            console.log("User found via direct lookup API:", directData.user.id);
            userToAdd = directData.user;
          }
        } catch (directError) {
          console.warn("Direct lookup API failed:", directError);
        }
      }
      
      // Try users/lookup API as last resort
      if (!userToAdd) {
        try {
          console.log("Trying users/lookup API as last resort");
          const lookupResponse = await fetch(`${request.nextUrl.origin}/api/users/lookup?email=${encodeURIComponent(email)}`);
          const lookupData = await lookupResponse.json();
          
          if (lookupResponse.ok && lookupData.user) {
            console.log("User found via lookup API:", lookupData.user.id);
            userToAdd = lookupData.user;
          }
        } catch (lookupError) {
          console.warn("Lookup API failed:", lookupError);
        }
      }
      
      // If still not found, we can't add this user
      if (!userToAdd) {
        console.error(`Cannot find user with email: ${email}`);
        return NextResponse.json(
          { error: `Cannot find user with email: ${email}. User must exist in the system.` },
          { status: 404 }
        );
      }
    }

    // Now check if this user is already a member of the workspace
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userToAdd.id)
      .single();

    if (existingMember) {
      // Update the role if the member already exists
      const { data: updatedMember, error: updateError } = await supabase
        .from("workspace_members")
        .update({ role })
        .eq("id", existingMember.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        message: "Member's role updated successfully",
        member: { 
          ...updatedMember, 
          profile: userToAdd 
        },
      });
    } else {
      // Insert new member - but don't use the added_by field if it's causing issues
      const memberData = {
        workspace_id: workspaceId,
        user_id: userToAdd.id,
        role,
        added_by: user.id  // Always include the current user's ID
      };
      
      console.log("Inserting new member with data:", JSON.stringify(memberData));
      
      const { data: newMember, error: insertError } = await supabase
        .from("workspace_members")
        .insert(memberData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Log that we would send an invitation email
      console.log(`[DEV] Invitation email would be sent to ${email} for workspace ${workspaceId}`);

      return NextResponse.json({
        message: "Member added successfully",
        member: { 
          ...newMember, 
          profile: userToAdd 
        },
      });
    }
  } catch (error) {
    console.error("Error in add member endpoint:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/members?id=<member_id>
// Remove a member from a workspace
export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("id");

  if (!memberId) {
    return NextResponse.json(
      { error: "Member ID is required" },
      { status: 400 }
    );
  }

  try {
    // Delete the member
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: "Member removed successfully",
      id: memberId,
    });
  } catch (error) {
    console.error("Error in delete member endpoint:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/members
// Update a member's role
export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await request.json();
  const { memberId, role } = body;

  if (!memberId || !role) {
    return NextResponse.json(
      { error: "Member ID and role are required" },
      { status: 400 }
    );
  }

  if (!["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be 'viewer', 'editor', or 'admin'" },
      { status: 400 }
    );
  }

  try {
    // Update the member's role
    const { data, error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("id", memberId)
      .select()
      .single();

    if (error) {
      throw error;
    }
    
    // Get the profile for the updated member
    const { data: profile } = await supabase
      .from("profiles")
      .select("*") 
      .eq("id", data.user_id)
      .single();

    return NextResponse.json({
      message: "Member role updated successfully",
      member: { ...data, profile },
    });
  } catch (error) {
    console.error("Error in update member role endpoint:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
} 