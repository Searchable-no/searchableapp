"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSetupPage() {
  const { session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const setupAdmin = async () => {
    if (!session?.user?.id) {
      setMessage("No user logged in. Please log in first.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("Setting up admin privileges...");

      // Make a request to our API endpoint that will set up admin privileges
      const response = await fetch("/api/admin-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set up admin");
      }

      setMessage("Admin setup successful! Redirecting to admin page...");
      
      // Wait a moment then redirect to the admin page
      setTimeout(() => {
        router.push("/admin");
        router.refresh(); // Force refresh to update sidebar
      }, 2000);
      
    } catch (error: any) {
      console.error("Error setting up admin:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This page will set up admin privileges for your account ({session?.user?.email}).
            Once set up, you'll have access to the admin dashboard.
          </p>
          
          <Button onClick={setupAdmin} disabled={isLoading}>
            {isLoading ? "Setting up..." : "Set Up Admin Access"}
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