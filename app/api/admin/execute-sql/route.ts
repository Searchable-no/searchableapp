import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    // Get the SQL to execute from the request body
    const { sql } = await request.json();
    
    if (!sql) {
      return NextResponse.json(
        { error: "SQL statement is required" },
        { status: 400 }
      );
    }

    // Execute the SQL using admin client
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      message: "SQL executed successfully",
      data
    });
  } catch (error: any) {
    console.error("Error executing SQL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute SQL" },
      { status: 500 }
    );
  }
} 