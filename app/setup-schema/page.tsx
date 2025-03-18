"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clipboard, Check, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SetupSchemaPage() {
  const [copied, setCopied] = useState(false);

  const sqlCommand = `ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="container max-w-4xl mx-auto pt-10 pb-20 px-4">
      <h1 className="text-3xl font-bold mb-6">Database Schema Setup</h1>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Schema Update Required</AlertTitle>
        <AlertDescription>
          We&apos;ve detected that your database schema needs to be updated to
          work with the latest features.
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-3">Supabase SQL to Run:</h2>
          <div className="bg-gray-900 text-white p-4 rounded-md font-mono text-sm mb-3 whitespace-pre-wrap overflow-x-auto">
            {sqlCommand}
          </div>
          <Button onClick={copyToClipboard} variant="outline" className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Instructions:</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Log in to your{" "}
              <a
                href="https://app.supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Supabase dashboard
              </a>
            </li>
            <li>Select your project</li>
            <li>Go to the SQL Editor tab</li>
            <li>Paste the SQL command above into the editor</li>
            <li>Click &quot;Run&quot; to execute the command</li>
            <li>Return to this application after running the command</li>
          </ol>
        </div>

        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Administrator Access Required</AlertTitle>
          <AlertDescription>
            You need to have administrator access to your Supabase project to
            run SQL commands.
          </AlertDescription>
        </Alert>

        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-3">Why is this needed?</h2>
          <p>
            The application requires an additional column in the profiles table
            to properly support workspace member management. This schema update
            adds the necessary column without affecting existing data.
          </p>
        </div>
      </div>
    </div>
  );
}
