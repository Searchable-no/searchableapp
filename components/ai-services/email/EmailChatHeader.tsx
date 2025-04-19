"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

interface ReturnInfo {
  returnPath: string;
  threadId?: string;
  emailId?: string;
  timestamp: number;
  label: string;
}

export function EmailChatHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [returnInfo, setReturnInfo] = useState<ReturnInfo | null>(null);
  const [subject, setSubject] = useState<string>("");
  const returnToEmail = searchParams.get("returnToEmail") === "true";

  useEffect(() => {
    // Get the stored return information
    const storedReturnInfo = localStorage.getItem("emailReturnInfo");
    if (storedReturnInfo) {
      try {
        const parsedInfo = JSON.parse(storedReturnInfo);
        setReturnInfo(parsedInfo);
      } catch (e) {
        console.error("Failed to parse return info:", e);
      }
    }

    // Get the subject from query parameters
    const subjectParam = searchParams.get("subject");
    if (subjectParam) {
      setSubject(decodeURIComponent(subjectParam));
    }
  }, [searchParams]);

  const handleReturnToEmail = () => {
    if (returnInfo?.returnPath) {
      router.push(returnInfo.returnPath);
    } else {
      // Default fallback
      router.push("/ai-services/email");
    }
  };

  if (!returnToEmail) {
    return null;
  }

  return (
    <div className="flex items-center h-14 px-4 border-b border-zinc-200 bg-white">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-zinc-600 hover:text-zinc-900"
        onClick={handleReturnToEmail}
      >
        <ArrowLeft className="h-4 w-4" />
        <Mail className="h-4 w-4" />
        <span className="sm:inline hidden">Back to Email</span>
      </Button>

      <div className="ml-auto mr-auto font-medium text-sm truncate max-w-[60%]">
        {subject ? `AI Response: ${subject}` : "AI Email Response"}
      </div>
    </div>
  );
}
