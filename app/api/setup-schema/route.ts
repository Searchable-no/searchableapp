import { NextResponse } from "next/server";

// GET /api/setup-schema
// Instructions for manual schema updates
export async function GET() {
  return NextResponse.json({
    message: "To add the is_placeholder column to the profiles table, run the following SQL in your Supabase SQL editor:",
    sql: "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;",
    instructions: [
      "1. Go to your Supabase dashboard",
      "2. Open the SQL Editor",
      "3. Paste the SQL command above",
      "4. Click 'Run'"
    ]
  });
} 