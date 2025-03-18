import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/users
// Fetch all users for workspace member selection
export async function GET() {
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

    // First try to get auth users directly from auth schema
    try {
      const { data: authUsers, error: authError } = await supabase
        .from('auth.users')
        .select('id, email, created_at');

      if (!authError && authUsers && authUsers.length > 0) {
        console.log(`Found ${authUsers.length} users from auth.users`);
        
        // Convert auth users to profiles format
        const usersWithProfiles = authUsers.map(authUser => {
          return {
            id: authUser.id,
            email: authUser.email,
            display_name: authUser.email.split('@')[0],
            avatar_url: null
          };
        });
        
        return NextResponse.json({
          users: usersWithProfiles
        });
      }
    } catch (authError) {
      console.warn("Could not access auth.users directly:", authError);
      // Continue to the fallback method
    }

    // Fallback: Query profiles to get all users
    console.log("Falling back to profiles table");
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .order('display_name', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    // If no profiles found, return empty array
    if (!profiles || profiles.length === 0) {
      console.log("No profiles found in profiles table");
      
      // Last resort - return at least the current user
      return NextResponse.json({
        users: [{
          id: user.id,
          email: user.email || 'unknown@example.com',
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Current User',
          avatar_url: user.user_metadata?.avatar_url || null
        }]
      });
    }
    
    return NextResponse.json({
      users: profiles || []
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
} 