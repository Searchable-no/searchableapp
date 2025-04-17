import { NextResponse } from "next/server";
import { searchEmails } from "@/lib/email-search";
import { type SearchResult } from "@/lib/microsoft-graph";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const userId = searchParams.get("userId");
    
    console.log("Emails search API called with params:", { 
      query, 
      userId: userId ? "provided" : "missing"
    });
    
    // If userId is provided, use it directly
    if (userId) {
      const results = await searchEmails(userId, query);
      console.log(`Found ${results.length} email results`);
      return NextResponse.json({
        results,
        count: results.length
      });
    }
    
    // Otherwise authenticate through the session
    try {
      // Get the authenticated user
      const supabase = createRouteHandlerClient({ cookies })
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user?.email) {
        console.error('Auth error:', authError)
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }

      // Get the user ID from the database
      const { data: userData, error: userDbError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (userDbError || !userData) {
        console.error('User DB error:', userDbError)
        return NextResponse.json(
          { error: 'User not found in database' },
          { status: 404 }
        )
      }
      
      // Search emails with the actual user ID
      const results = await searchEmails(userData.id, query);
      console.log(`Found ${results.length} email results`);
      
      return NextResponse.json({
        results,
        count: results.length
      });
    } catch (error) {
      console.error("Error in email search auth flow:", error);
      return NextResponse.json(
        { error: "Failed to authenticate for email search" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}