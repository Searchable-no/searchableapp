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

// GET /api/admin/users
// Fetch all users (admin only)
export async function GET(request: NextRequest) {
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

    // Fetch all users from the auth.users table using admin access
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      throw error;
    }

    // Get profiles data to merge with users
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, display_name, avatar_url");

    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }

    // Map auth users to a more client-friendly format
    const formattedUsers = users.users.map(user => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false,
        created_at: user.created_at,
      };
    });
    
    return NextResponse.json({
      users: formattedUsers
    });
  } catch (error) {
    console.error("Error in admin users endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users
// Create a new user or invite existing user (admin only)
export async function POST(request: NextRequest) {
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
    const { email, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    let existingUser;
    try {
      // Try to find the user by email using admin.listUsers()
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      existingUser = data?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    } catch (error) {
      console.error("Error finding existing user:", error);
      // Continue with user creation if we can't find the user
    }

    let userId;

    if (existingUser) {
      // User already exists
      userId = existingUser.id;
    } else {
      // Create new user with a temporary password
      // In a real app, you might want to send an invitation email
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-2) + "!1";
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
      });

      if (createError) {
        throw createError;
      }

      userId = newUser.user.id;
    }

    // Update or create profile with admin status if needed
    const isAdminUser = role === 'admin';
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        display_name: email.split('@')[0],
        is_admin: isAdminUser,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({
      message: "User added successfully",
      userId: userId,
    });
  } catch (error) {
    console.error("Error in create user endpoint:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
} 