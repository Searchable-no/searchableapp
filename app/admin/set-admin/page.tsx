"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetAdminPage() {
  const { session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClientComponentClient();

  const makeAdmin = async () => {
    if (!session?.user?.id) {
      setMessage("No user logged in");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("Setting admin privileges...");

      // First add the column if it doesn't exist
      const addColumnResponse = await fetch("/api/admin/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false",
        }),
      });

      if (!addColumnResponse.ok) {
        const errorData = await addColumnResponse.json();
        throw new Error(`Error adding column: ${errorData.error || 'Unknown error'}`);
      }

      // Then update the current user's profile
      const updateResponse = await fetch("/api/admin/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: `UPDATE profiles SET is_admin = true WHERE id = '${session.user.id}'`,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Error updating profile: ${errorData.error || 'Unknown error'}`);
      }

      setMessage(`Success! User ${session.user.email} is now an admin. Please refresh the page and check the sidebar.`);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Make Current User Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This page will make the current user ({session?.user?.email}) an admin.</p>
          <Button onClick={makeAdmin} disabled={isLoading}>
            {isLoading ? "Processing..." : "Make Admin"}
          </Button>
          {message && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p>{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 