"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminCheckPage() {
  const { session } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hasColumn, setHasColumn] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClientComponentClient();

  const checkAdmin = async () => {
    if (!session?.user?.id) {
      setMessage("No user logged in. Please log in first.");
      return;
    }

    try {
      setIsChecking(true);
      setMessage("Checking admin status...");

      // First check if the column exists
      const { data: columnData, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'profiles')
        .eq('column_name', 'is_admin');

      const columnExists = !columnError && columnData && columnData.length > 0;
      setHasColumn(columnExists);
      
      if (!columnExists) {
        setMessage("The is_admin column does not exist in the profiles table. Please run the SQL statement shown below.");
        setIsAdmin(false);
        return;
      }

      // Check if the user is admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        setMessage(`Error checking profile: ${profileError.message}`);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(profile?.is_admin || false);
      
      if (profile?.is_admin) {
        setMessage("You have admin privileges! Try refreshing the page to see the admin link in the sidebar.");
      } else {
        setMessage("You don't have admin privileges. Run the SQL statement below to grant yourself admin access.");
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Status Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="mb-2">Current user: {session?.user?.email || "Not logged in"}</p>
            <p className="mb-2">User ID: {session?.user?.id || "Unknown"}</p>
            <p className="mb-2">is_admin column exists: {hasColumn === null ? "Unknown" : hasColumn ? "Yes" : "No"}</p>
            <p className="mb-2">Admin status: {isAdmin === null ? "Unknown" : isAdmin ? "Yes" : "No"}</p>
          </div>
          
          <Button onClick={checkAdmin} disabled={isChecking} className="mb-4">
            {isChecking ? "Checking..." : "Check Admin Status"}
          </Button>
          
          {message && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md mb-4">
              <p>{message}</p>
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <p className="font-medium mb-2">SQL to Run:</p>
            <pre className="bg-black text-white p-2 rounded-md overflow-x-auto">
              {`-- Add the is_admin column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set your user as admin (use your actual user ID)
UPDATE profiles SET is_admin = true WHERE id = '${session?.user?.id || "YOUR_USER_ID"}';`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 