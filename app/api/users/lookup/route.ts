import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/users/lookup?email=user@example.com
// Find a user by email address
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
    // Get current user's ID for authorization check
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.log(`Looking up user with email: ${email}`);
    
    // We'll collect user data from multiple sources to maximize chances of finding the user
    let foundUser = null;
    
    // First try to use the auth.users table directly
    try {
      // Try direct query first (only works with admin privileges)
      const { data: authUsersData, error: authError } = await supabase
        .from('auth.users')
        .select('id, email, user_metadata')
        .ilike('email', email)
        .limit(1);
        
      if (!authError && authUsersData && authUsersData.length > 0) {
        const authUser = authUsersData[0];
        console.log("User found via direct auth.users query:", authUser.id);
        
        foundUser = {
          id: authUser.id,
          email: authUser.email,
          display_name: authUser.user_metadata?.display_name || authUser.email.split('@')[0],
          avatar_url: authUser.user_metadata?.avatar_url || null
        };
      }
    } catch (authTableError) {
      console.warn("Cannot query auth.users directly:", authTableError);
    }
    
    // Next try admin APIs
    if (!foundUser) {
      try {
        // Use admin.listUsers (requires Supabase admin privileges)
        console.log("Attempting to use admin.listUsers API");
        const { data: allUsersData } = await supabase.auth.admin.listUsers();
        
        if (allUsersData?.users) {
          const matchingUser = allUsersData.users.find(u => 
            u.email?.toLowerCase() === email.toLowerCase()
          );
          
          if (matchingUser) {
            console.log("User found via admin.listUsers API:", matchingUser.id);
            foundUser = {
              id: matchingUser.id,
              email: matchingUser.email || email,
              display_name: matchingUser.user_metadata?.display_name || 
                matchingUser.email?.split('@')[0] || email.split('@')[0],
              avatar_url: matchingUser.user_metadata?.avatar_url || null
            };
          }
        }
      } catch (adminError) {
        console.warn("Admin API access failed:", adminError);
      }
    }
    
    // If still not found, try the profiles table as last resort
    if (!foundUser) {
      console.log("Checking profiles table as last resort");
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .eq('email', email)
        .single();
        
      if (profile) {
        console.log("User found in profiles table:", profile.id);
        foundUser = profile;
      } else {
        console.log("User not found in profiles table");
      }
    }
    
    // If still not found, make a special direct attempt using a raw query
    if (!foundUser) {
      try {
        console.log("Attempting rpc function");
        // Create or use an RPC function in your Supabase project to find users
        const { data: rpcResult } = await supabase.rpc('find_user_by_email', { 
          email_param: email 
        });
        
        if (rpcResult && rpcResult.id) {
          console.log("User found via RPC function:", rpcResult.id);
          foundUser = rpcResult;
        }
      } catch (rpcError) {
        console.warn("RPC function failed or doesn't exist:", rpcError);
      }
    }
    
    // Return result
    if (!foundUser) {
      console.log(`No user found with email: ${email}`);
      return NextResponse.json({
        message: "User not found",
        user: null
      });
    }
    
    console.log(`Successfully found user with email: ${email}, ID: ${foundUser.id}`);
    return NextResponse.json({
      user: foundUser
    });
  } catch (error) {
    console.error("Error looking up user:", error);
    return NextResponse.json(
      { error: "Failed to lookup user" },
      { status: 500 }
    );
  }
} 