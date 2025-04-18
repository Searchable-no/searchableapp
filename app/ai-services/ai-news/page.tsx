"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Newspaper, Plus, Trash2, Search, Send } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import Chat, { Message } from "@/components/ai-services/Chat";

export default function AINewsPage() {
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const { session } = useSession();
  const supabase = createClientComponentClient();

  // Add a new source URL
  const addSource = () => {
    console.log("addSource called with:", newSource);
    if (!newSource.trim()) {
      toast.error("Vennligst skriv inn en URL");
      return;
    }

    try {
      // Simple URL validation
      new URL(newSource);
      if (!sources.includes(newSource)) {
        const updatedSources = [...sources, newSource];
        setSources(updatedSources);
        setNewSource("");
        toast.success("Kilde lagt til");
        console.log("Sources updated:", updatedSources);
      } else {
        toast.error("Denne URL-en er allerede lagt til");
      }
    } catch (e) {
      toast.error("Ugyldig URL format");
    }
  };

  // Remove a source URL
  const removeSource = (sourceToRemove: string) => {
    setSources(sources.filter((source) => source !== sourceToRemove));
  };

  // Perform web search using OpenAI
  const handleChatSubmit = async (message: string) => {
    if (sources.length === 0) {
      toast.error("Legg til minst én kilde først");
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    setInput("");

    // Start loading state
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-news/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sources,
          query: message,
        }),
      });

      if (!response.ok) {
        throw new Error("Søket feilet");
      }

      const data = await response.json();

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.result,
        },
      ]);
    } catch (error) {
      console.error("Error searching news:", error);
      setError("Kunne ikke fullføre søket. Prøv igjen senere.");
      toast.error("Kunne ikke fullføre søket. Prøv igjen senere.");
    } finally {
      setIsLoading(false);
    }
  };

  // Header component
  const HeaderComponent = () => (
    <div className="flex flex-col items-center text-center space-y-3 pt-8 pb-6">
      <div className="bg-[#5E5ADB]/10 p-4 rounded-full">
        <Newspaper className="h-8 w-8 text-[#5E5ADB]" />
      </div>
      <h1 className="text-2xl font-bold">AI Nyheter</h1>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Få oppdateringer fra dine favorittkilder. Legg til nyhetskilder og still
        spørsmål om aktuelle nyheter.
      </p>
    </div>
  );

  return (
    <div className="container h-screen flex flex-col overflow-hidden">
      <div className="py-6">
        {/* Sources Card */}
        <Card className="w-full shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle>Nyhetskilder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="https://www.example.com"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSource()}
                className="flex-1 bg-gray-50 border-gray-200"
              />
              <Button
                type="button"
                onClick={addSource}
                size="default"
                className="px-6 py-2 w-full sm:w-auto gap-2 bg-[#5E5ADB]"
              >
                <Plus className="h-4 w-4" />
                Legg til kilde
              </Button>
            </div>

            {sources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Dine kilder ({sources.length}):
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md bg-gray-50 p-2">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-white border p-2"
                    >
                      <span className="text-sm truncate">{source}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSource(source)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <Chat
          messages={messages}
          onSubmit={handleChatSubmit}
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          error={error}
          headerComponent={<HeaderComponent />}
          assistantName="AI News"
          disabled={sources.length === 0}
          placeholder={
            sources.length === 0
              ? "Legg til nyhetskilder først..."
              : "Still et spørsmål om aktuelle nyheter..."
          }
        />
      </div>
    </div>
  );
}
