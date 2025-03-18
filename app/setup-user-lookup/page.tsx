"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clipboard, Check, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SetupUserLookupPage() {
  const [copied, setCopied] = useState(false);

  const sqlCommand = `-- Function to find a user by email
-- This function can be called by authenticated users but only returns basic user information
CREATE OR REPLACE FUNCTION find_user_by_email(email_param TEXT)
RETURNS json AS $$
DECLARE
  user_record RECORD;
  result_json json;
BEGIN
  -- Look up the user ID from auth.users
  -- This requires security definer to bypass RLS
  SELECT id, email 
  INTO user_record
  FROM auth.users
  WHERE email = email_param
  LIMIT 1;
  
  -- If we found a user, return basic information
  IF FOUND THEN
    -- Construct a result with minimal information
    SELECT json_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'display_name', split_part(user_record.email, '@', 1), -- Simple display name from email
      'avatar_url', NULL -- No avatar
    ) INTO result_json;
    
    RETURN result_json;
  ELSE
    -- No user found
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission for authenticated users to execute the function
GRANT EXECUTE ON FUNCTION find_user_by_email(TEXT) TO authenticated;

-- Alternative function that returns a row directly
CREATE OR REPLACE FUNCTION query_user_by_email_workaround(email_to_find TEXT)
RETURNS json AS $$
DECLARE
  found_user RECORD;
BEGIN
  -- Direct query to auth.users
  SELECT id, email
  INTO found_user
  FROM auth.users
  WHERE email = email_to_find
  LIMIT 1;
  
  IF FOUND THEN
    RETURN json_build_object(
      'id', found_user.id,
      'email', found_user.email
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION query_user_by_email_workaround(TEXT) TO authenticated;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="container max-w-4xl mx-auto pt-10 pb-20 px-4">
      <h1 className="text-3xl font-bold mb-6">Setup User Lookup Functions</h1>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>SQL Functions Required</AlertTitle>
        <AlertDescription>
          To fix the issue with finding users by email, you need to add SQL
          functions to your Supabase database. These functions will allow your
          application to find users in the auth.users table directly.
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
          <AlertTitle>Why Users Cannot Be Found</AlertTitle>
          <AlertDescription className="prose prose-sm mt-2">
            <p>The issue occurs because:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                Supabase stores users in <code>auth.users</code> table, but this
                table isn&apos;t directly accessible from client APIs
              </li>
              <li>
                Your app needs a <code>profiles</code> table row for each user
                to find them via regular queries
              </li>
              <li>
                Some users might exist in <code>auth.users</code> but not have a
                corresponding <code>profiles</code> entry
              </li>
              <li>
                These SQL functions allow the app to find users directly in the{" "}
                <code>auth.users</code> table
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-3">Alternative Solution</h2>
          <p className="mb-4">
            Instead of running these SQL functions, you can also ensure that all
            users have a corresponding entry in the profiles table. This
            typically happens on sign-up, but you might need to create profile
            entries for existing users.
          </p>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Profiles Table</AlertTitle>
            <AlertDescription>
              Make sure each user in auth.users has a matching row in the
              profiles table with the same ID and email address.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
