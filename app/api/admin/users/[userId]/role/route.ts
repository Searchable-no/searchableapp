import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Helper to check if user is admin
async function isAdmin(userId: string) {
  // First check if the user exists in the profiles table with is_admin flag
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (profile?.is_admin) {
    return true;
  }

  // If not found or not admin in profiles, return false
  return false;
}

// PATCH /api/admin/users/[userId]/role
// Update a user's admin status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user's ID for authorization check
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { is_admin } = body;
    const { userId } = params;

    if (typeof is_admin !== 'boolean') {
      return NextResponse.json(
        { error: "is_admin must be a boolean value" },
        { status: 400 }
      );
    }

    // Prevent admin from removing their own admin privileges
    if (userId === user.id && !is_admin) {
      return NextResponse.json(
        { error: "You cannot remove your own admin privileges" },
        { status: 400 }
      );
    }

    // First check if the user profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    console.log("Existing profile:", existingProfile);
    
    // Get target user data to access their email if we need to create a profile
    let targetUserEmail = existingProfile?.email;
    if (!targetUserEmail) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      targetUserEmail = userData?.user?.email || 'unknown@example.com';
      console.log("Found user email from auth:", targetUserEmail);
    }

    let result;
    
    // If profile exists, update it
    if (existingProfile) {
      console.log("Updating existing profile with ID:", userId);
      result = await supabaseAdmin
        .from("profiles")
        .update({
          is_admin: is_admin,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } else {
      // If profile doesn't exist, create it
      console.log("Creating new profile with ID:", userId);
      result = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          is_admin: is_admin,
          updated_at: new Date().toISOString(),
          email: targetUserEmail,
          display_name: targetUserEmail ? targetUserEmail.split('@')[0] : 'Unknown',
          created_at: new Date().toISOString()
        });
    }
    
    const { error: updateError, data: updateData } = result;

    if (updateError) {
      console.error("Supabase update error:", updateError);
      throw updateError;
    }

    console.log("Update successful:", updateData);
    return NextResponse.json({
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    
    // More detailed error response
    let errorMessage = "Failed to update user role";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 