import { NextRequest, NextResponse } from "next/server";
// Note: We'll re-add the supabase import when implementing real functionality
// import { supabase } from "@/lib/supabase-browser";

// Define member type
interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    email: string;
    display_name: string;
    avatar_url: string | null;
  };
}

// In-memory storage for development
const workspaceMembers: Record<string, WorkspaceMember[]> = {};

// GET /api/workspaces/members?workspaceId=<id>
// Fetch members of a workspace
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace ID is required" },
      { status: 400 }
    );
  }

  // For development, return mock data plus any added members
  console.log("Getting members for workspace:", workspaceId);
  
  return NextResponse.json({
    owner: {
      user_id: "dev-owner-123",
      role: "owner",
      email: "owner@example.com",
      display_name: "Workspace Owner",
      avatar_url: null,
    },
    members: workspaceMembers[workspaceId] || [],
  });
}

// POST /api/workspaces/members
// Add a new member to a workspace
export async function POST(request: NextRequest) {
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
    // For development, we'll simulate a successful member addition
    console.log("Adding member with email:", email, "role:", role, "to workspace:", workspaceId);
    
    // Create a mockId based on the inputs
    const mockId = `dev-${Date.now()}-${email.substring(0, 5)}`;
    
    const newMember = {
      id: mockId,
      workspace_id: workspaceId,
      user_id: `dev-user-${email.substring(0, 8)}`,
      role,
      created_at: new Date().toISOString(),
      profiles: {
        email,
        display_name: email.split('@')[0],
        avatar_url: null
      }
    };
    
    // Save to our in-memory storage
    if (!workspaceMembers[workspaceId]) {
      workspaceMembers[workspaceId] = [];
    }
    
    // Check if member with this email already exists
    const existingIndex = workspaceMembers[workspaceId].findIndex(
      m => m.profiles.email === email
    );
    
    if (existingIndex >= 0) {
      // Update the existing member
      workspaceMembers[workspaceId][existingIndex].role = role;
      return NextResponse.json({
        message: "Member's role updated successfully",
        member: workspaceMembers[workspaceId][existingIndex]
      });
    } else {
      // Add the new member
      workspaceMembers[workspaceId].push(newMember);
    }
    
    return NextResponse.json({
      message: "Member added successfully",
      member: newMember,
    });
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
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("id");

  if (!memberId) {
    return NextResponse.json(
      { error: "Member ID is required" },
      { status: 400 }
    );
  }

  try {
    // For development, actually remove from our in-memory storage
    console.log("Deleting member with ID:", memberId);
    
    // Find the workspace this member belongs to
    for (const workspaceId in workspaceMembers) {
      const index = workspaceMembers[workspaceId].findIndex(m => m.id === memberId);
      if (index >= 0) {
        // Remove the member
        workspaceMembers[workspaceId].splice(index, 1);
        break;
      }
    }
    
    return NextResponse.json({ 
      message: "Member removed successfully",
      id: memberId
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
    // For development, actually update our in-memory storage
    console.log("Updating member", memberId, "to role:", role);
    
    // Find the member in our storage
    let updatedMember = null;
    for (const workspaceId in workspaceMembers) {
      const index = workspaceMembers[workspaceId].findIndex(m => m.id === memberId);
      if (index >= 0) {
        // Update the role
        workspaceMembers[workspaceId][index].role = role;
        updatedMember = workspaceMembers[workspaceId][index];
        break;
      }
    }
    
    if (!updatedMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: "Member role updated successfully",
      member: updatedMember
    });
  } catch (error) {
    console.error("Error in update member role endpoint:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
} 