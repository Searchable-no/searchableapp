import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin-setup
// Set up admin privileges for the current user
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user's ID
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Make the current user an admin by updating their profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', user.id);

    if (updateError) {
      // If there's an error (possibly because the column doesn't exist),
      // return a message to run the SQL manually
      return NextResponse.json(
        { error: "The is_admin column might not exist. Please run 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;' in your Supabase SQL editor first." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin setup completed successfully"
    });
  } catch (error: any) {
    console.error("Error in admin setup:", error);
    return NextResponse.json(
      { error: error.message || "Failed to set up admin privileges" },
      { status: 500 }
    );
  }
} 