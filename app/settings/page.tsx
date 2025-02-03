"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Box, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session";

interface ConnectionStatus {
  microsoft: boolean;
  google: boolean;
}

interface IndexingProgress {
  progress: number;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus>({
    microsoft: false,
    google: false,
  });
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress>({ progress: 0 });
  const searchParams = useSearchParams();
  const { session, loading: sessionLoading } = useSession();

  // Fetch connection status
  const fetchConnectionStatus = async () => {
    if (!session?.user?.email) {
      console.log("No user email available");
      return;
    }

    try {
      const response = await fetch(
        `/api/connections/status?email=${encodeURIComponent(
          session.user.email
        )}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch connection status");
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching connection status:", error);
      toast.error("Failed to fetch connection status");
    }
  };

  // Fetch indexing progress
  const fetchIndexingProgress = async () => {
    if (!session?.user?.email) {
      return;
    }

    try {
      const response = await fetch(
        `/api/connections/indexing-status?email=${encodeURIComponent(
          session.user.email
        )}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch indexing progress");
      }
      const data = await response.json();
      setIndexingProgress(data);
    } catch (error) {
      console.error("Error fetching indexing progress:", error);
    }
  };

  useEffect(() => {
    if (session?.user?.email && !sessionLoading) {
      fetchConnectionStatus();
      fetchIndexingProgress();
      
      // Poll indexing progress every 5 seconds if connected
      let interval: NodeJS.Timeout;
      if (status.microsoft) {
        interval = setInterval(fetchIndexingProgress, 5000);
      }
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [session, sessionLoading, status.microsoft]);

  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get("success");

    if (error) {
      toast.error("Connection failed: " + error);
    }
    if (success) {
      toast.success("Successfully connected!");
      // Refresh connection status after successful connection
      fetchConnectionStatus();
    }
  }, [searchParams]);

  const handleMicrosoftConnect = async () => {
    if (sessionLoading) {
      toast.error("Please wait while we load your session");
      return;
    }

    if (!session?.user?.email) {
      toast.error("Please sign in to connect your account");
      return;
    }

    if (status.microsoft) {
      // Handle disconnect
      try {
        console.log("Attempting to disconnect with email:", session.user.email);

        const response = await fetch("/api/auth/microsoft/disconnect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: session.user.email }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.error("Disconnect error response:", data);
          throw new Error(data.error || "Failed to disconnect");
        }

        await fetchConnectionStatus();
        toast.success("Successfully disconnected from Microsoft 365");
      } catch (error) {
        console.error("Error disconnecting:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to disconnect from Microsoft 365"
        );
      }
    } else {
      window.location.href = "/api/auth/microsoft";
    }
  };

  const handleGoogleConnect = async () => {
    if (status.google) {
      // Handle disconnect
      try {
        const response = await fetch("/api/auth/google/disconnect", {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Failed to disconnect");
        }
        await fetchConnectionStatus();
        toast.success("Successfully disconnected from Google Workspace");
      } catch (error) {
        console.error("Error disconnecting:", error);
        toast.error("Failed to disconnect from Google Workspace");
      }
    } else {
      window.location.href = "/api/auth/google";
    }
  };

  return (
    <SidebarInset className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#000000]">
          Settings
        </h1>

        <div className="space-y-6">
          <div className="rounded-lg border border-[#ecf1f8] bg-[#ffffff] p-6">
            <h2 className="text-xl font-semibold mb-4">Data Sources</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ecf1f8] text-[#0078d4]">
                    <Box className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Microsoft 365</h3>
                    <p className="text-sm text-[#8b8d97]">
                      {status.microsoft
                        ? "Connected to SharePoint, Teams, Outlook"
                        : "Connect to SharePoint, Teams, Outlook"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {status.microsoft && indexingProgress.progress < 100 && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 transition-all duration-500 ease-out"
                          style={{ width: `${indexingProgress.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{indexingProgress.progress}%</span>
                    </div>
                  )}
                  <Button
                    onClick={handleMicrosoftConnect}
                    className={
                      status.microsoft
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-[#0078d4] hover:bg-[#106ebe]"
                    }
                  >
                    {status.microsoft ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ecf1f8] text-[#ea4335]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Google Workspace</h3>
                    <p className="text-sm text-[#8b8d97]">
                      {status.google
                        ? "Connected to Gmail, Drive, Calendar"
                        : "Connect to Gmail, Drive, Calendar"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleGoogleConnect}
                  className={
                    status.google
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-[#ea4335] hover:bg-[#d33828]"
                  }
                >
                  {status.google ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
