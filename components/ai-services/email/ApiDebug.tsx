"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, AlertCircle, Server } from "lucide-react";
import { getData, refreshTileData } from "@/app/dashboard/actions";

export function ApiDebug() {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setHealthStatus(null);
    setErrorDetails(null);

    try {
      const response = await fetch("/api/emails/health");
      const data = await response.json();
      setHealthStatus(`Status: ${response.status} - ${JSON.stringify(data)}`);
    } catch (error) {
      setErrorDetails(`Health check error: ${error}`);
      setHealthStatus("Failed - See console for details");
      console.error("API health check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkEmails = async () => {
    setLoading(true);
    setEmailStatus(null);
    setErrorDetails(null);

    try {
      console.log("Testing server action for emails...");
      const data = await getData(["email"]);

      if (data.error) {
        setEmailStatus(`Error: ${data.error}`);
        setErrorDetails(JSON.stringify(data, null, 2));
      } else {
        setEmailStatus(`Success - Found ${data.emails?.length || 0} emails`);
        setErrorDetails(
          JSON.stringify(data.emails?.slice(0, 2) || [], null, 2)
        );
      }
    } catch (error) {
      setErrorDetails(`Server action error: ${error}`);
      setEmailStatus("Failed - See console for details");
      console.error("Server action error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">API Debug Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Button
              size="sm"
              onClick={checkHealth}
              disabled={loading}
              className="mr-2"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check API Health
            </Button>
            <Button
              size="sm"
              onClick={checkEmails}
              disabled={loading}
              className="flex items-center"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Server className="h-4 w-4 mr-1" />
              Test Server Action
            </Button>
          </div>

          {healthStatus && (
            <div className="p-2 bg-muted rounded text-xs">
              <p className="font-medium">Health API Response:</p>
              <p>{healthStatus}</p>
            </div>
          )}

          {emailStatus && (
            <div className="p-2 bg-muted rounded text-xs">
              <p className="font-medium">Server Action Response:</p>
              <p>{emailStatus}</p>
            </div>
          )}

          {errorDetails && (
            <div className="p-2 bg-red-50 rounded text-xs overflow-auto max-h-40">
              <p className="font-medium text-red-800">Response Details:</p>
              <pre className="whitespace-pre-wrap">{errorDetails}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
