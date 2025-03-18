"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2, Copy } from "lucide-react";

export default function SetupWorkspaceTablesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    needsManualSetup?: boolean;
    sql?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const setupTables = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup-workspace-tables");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to set up workspace tables. Check console for details.",
      });
      console.error("Error setting up workspace tables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copySql = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Setup Workspace Tables</CardTitle>
          <CardDescription>
            This will check if the necessary database tables and policies for
            the Workspaces feature are set up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={setupTables} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking workspace tables...
              </>
            ) : (
              "Check Workspace Tables"
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.success ? "Success!" : "Action Required"}
              </AlertTitle>
              <AlertDescription>
                {result.message ||
                  result.error ||
                  "Failed to set up workspace tables."}
              </AlertDescription>
            </Alert>
          )}

          {result?.needsManualSetup && result?.sql && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium">
                  SQL to Run in Supabase Dashboard
                </h3>
                <Button variant="outline" size="sm" onClick={copySql}>
                  {copied ? "Copied!" : "Copy SQL"}
                  <Copy className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-x-auto text-sm whitespace-pre-wrap">
                  {result.sql}
                </pre>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>To create the required tables:</p>
                <ol className="list-decimal ml-5 mt-2 space-y-2">
                  <li>Go to your Supabase project dashboard</li>
                  <li>Navigate to the SQL Editor</li>
                  <li>Create a new query</li>
                  <li>Paste the SQL above</li>
                  <li>Run the query</li>
                  <li>
                    Return to this page and click "Check Workspace Tables" again
                  </li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
