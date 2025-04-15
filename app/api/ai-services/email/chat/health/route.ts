import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get the auth cookie directly
    const cookies = request.headers.get('cookie') || '';
    console.log("Health check cookies header:", cookies ? "Present" : "Missing");
    
    // Extract token from cookies
    const authCookieName = 'sb-hswomyklnknfhmnlivgj-auth-token';
    const authCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith(`${authCookieName}=`));
    
    if (!authCookie) {
      console.log("Auth cookie not found in health check");
      return NextResponse.json({ 
        status: "error", 
        auth: false, 
        error: "Authentication required" 
      }, { status: 401 });
    }
    
    // If we got here, authentication is working
    return NextResponse.json({
      status: "ok",
      auth: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({ 
      status: "error", 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 