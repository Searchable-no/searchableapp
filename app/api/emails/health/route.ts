import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Emails API health check"
  });
} 