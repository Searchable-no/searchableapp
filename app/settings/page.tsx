"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Box, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface ConnectionStatus {
  microsoft: boolean;
  google: boolean;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus>({
    microsoft: false,
    google: false,
  });
  const searchParams = useSearchParams();

  // Fetch connection status
  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch("/api/connections/status");
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

  useEffect(() => {
    fetchConnectionStatus();
  }, []); // Fetch on mount

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
    if (status.microsoft) {
      // Handle disconnect
      try {
        const response = await fetch("/api/auth/microsoft/disconnect", {
          method: "POST",
        });
        const data = await response.json();

        if (!response.ok) {
          console.error("Disconnect error response:", data);
          throw new Error(data.details || "Failed to disconnect");
        }

        await fetchConnectionStatus();
        toast.success("Successfully disconnected from Microsoft 365");
      } catch (error) {
        console.error("Error disconnecting:", error);
        toast.error("Failed to disconnect from Microsoft 365");
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
