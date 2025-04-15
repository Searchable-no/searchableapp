"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileAudio, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface MinuteSegment {
  text: string;
  start: number;
  end: number;
  speaker: string;
  speakerContributions: Array<{
    speaker: string;
    text: string;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      speaker: string;
    }>;
  }>;
}

interface TranscriptionResult {
  transcriptionId: string;
  status: string;
  text?: string;
  minuteSegments?: MinuteSegment[];
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker: string;
  }>;
}

// Format seconds to mm:ss format
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function TranscriptionService() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResult | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Ingen fil valgt",
        description: "Vennligst velg en lydfil for å transkribere",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setTranscriptionResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai-services/transcription", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke transkribere filen");
      }

      setTranscriptionResult({
        transcriptionId: data.transcriptionId,
        status: data.status,
      });

      if (data.status === "completed") {
        // If transcription is immediately complete, fetch results
        await checkTranscriptionStatus(data.transcriptionId);
      } else {
        // Otherwise poll for status
        pollTranscriptionStatus(data.transcriptionId);
      }

      toast({
        title: "Opplasting vellykket",
        description: "Transkribering er startet. Dette kan ta litt tid.",
      });
    } catch (error) {
      toast({
        title: "Feil ved opplasting",
        description:
          error instanceof Error
            ? error.message
            : "Kunne ikke transkribere filen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pollTranscriptionStatus = async (transcriptionId: string) => {
    // Poll every 5 seconds until complete or error
    const intervalId = setInterval(async () => {
      try {
        const complete = await checkTranscriptionStatus(transcriptionId);
        if (complete) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error("Polling error:", error);
        clearInterval(intervalId);
      }
    }, 5000);
  };

  const checkTranscriptionStatus = async (
    transcriptionId: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/ai-services/transcription/status?id=${transcriptionId}`
      );
      const data = await response.json();

      console.log("Status check response:", data);

      if (data.status === "completed" && data.text) {
        // Store completed result
        setTranscriptionResult({
          transcriptionId,
          status: data.status,
          text: data.text,
          segments: data.segments,
          minuteSegments: data.minuteSegments,
        });

        // Save the transcription to localStorage for persistence
        try {
          const storageKey = `transcription_${transcriptionId}`;
          const storageData = JSON.stringify({
            transcriptionId,
            status: data.status,
            text: data.text,
            segments: data.segments,
            minuteSegments: data.minuteSegments,
          });

          console.log("Saving to localStorage with key:", storageKey);
          console.log("Storage data size:", storageData.length, "bytes");

          localStorage.setItem(storageKey, storageData);

          // Verify the save worked
          const savedItem = localStorage.getItem(storageKey);
          console.log(
            "Verified localStorage save:",
            savedItem ? "success" : "failed"
          );
          console.log(
            "All localStorage keys after save:",
            Object.keys(localStorage)
          );

          if (savedItem) {
            try {
              const parsed = JSON.parse(savedItem);
              console.log("Saved transcription has text:", !!parsed.text);
            } catch (e) {
              console.error("Could not parse saved transcription:", e);
            }
          }
        } catch (err) {
          console.error("Failed to save transcription to localStorage:", err);
        }

        return true;
      } else if (data.status === "failed") {
        setTranscriptionResult({
          transcriptionId,
          status: "failed",
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to check transcription status:", error);
      return false;
    }
  };

  // Extract unique speakers
  const speakers = transcriptionResult?.segments
    ? Array.from(
        new Set(transcriptionResult.segments.map((segment) => segment.speaker))
      )
    : [];

  const speakerColors: Record<string, string> = {};
  speakers.forEach((speaker, index) => {
    // Assign a color based on index
    speakerColors[speaker] = index === 0 ? "bg-amber-100" : "bg-blue-100";
  });

  const openChatInNewWindow = () => {
    if (!transcriptionResult?.transcriptionId) return;

    // Make sure the transcription is in localStorage before opening chat
    try {
      const storageKey = `transcription_${transcriptionResult.transcriptionId}`;
      const storageData = JSON.stringify({
        transcriptionId: transcriptionResult.transcriptionId,
        status: transcriptionResult.status,
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
        minuteSegments: transcriptionResult.minuteSegments,
      });

      // Save or update the transcription in localStorage right before opening chat
      localStorage.setItem(storageKey, storageData);
      console.log("Updated transcription in localStorage before opening chat");

      // Verify it's there
      const savedItem = localStorage.getItem(storageKey);
      if (!savedItem) {
        console.error("Failed to verify transcription in localStorage");
        // Show error toast
        toast({
          title: "Lagringsfeil",
          description:
            "Kunne ikke lagre transkripsjonen for chat. Prøv på nytt.",
          variant: "destructive",
        });
        return;
      }
    } catch (err) {
      console.error(
        "Failed to save transcription to localStorage before chat:",
        err
      );
      toast({
        title: "Lagringsfeil",
        description: "Kunne ikke lagre transkripsjonen for chat. Prøv på nytt.",
        variant: "destructive",
      });
      return;
    }

    // Open chat page in a new window with the transcription ID and title as parameters
    const url = `/ai-services/transcription/chat?id=${
      transcriptionResult.transcriptionId
    }&title=${encodeURIComponent(file?.name || "Transkripsjon")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col w-full h-full">
      <h1 className="text-2xl font-bold">Transkribering</h1>
      <p className="text-muted-foreground mb-6">
        Last opp lydfiler og få dem transkribert med AI
      </p>

      {/* Upload section - minimal at the top */}
      <div className="flex items-center gap-4 mb-6 border rounded-md p-4 bg-muted/30">
        <div className="flex-1 flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-muted-foreground" />
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="text-sm flex-1"
            id="file-upload"
          />
        </div>
        <Button
          onClick={handleUpload}
          disabled={!file || loading}
          className="shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transkriberer...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Start transkribering
            </>
          )}
        </Button>
      </div>

      {/* File name display if selected */}
      {file && (
        <div className="text-sm font-medium mb-4">
          Valgt fil: <span className="text-muted-foreground">{file.name}</span>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center p-8 border rounded-md mb-6 bg-muted/20">
          <Loader2 className="h-6 w-6 text-primary animate-spin mr-2" />
          <p>Transkriberer lydfil, vennligst vent...</p>
        </div>
      )}

      {/* Transcript display */}
      {transcriptionResult?.status === "completed" &&
      transcriptionResult.segments?.length ? (
        <div className="flex flex-col mb-6">
          <div className="bg-white border rounded-md overflow-hidden">
            {/* Speakers header */}
            <div className="border-b p-3 flex items-center">
              <h3 className="text-base font-semibold mr-4">Speakers</h3>
              <div className="flex flex-row space-x-4">
                {speakers.map((speaker, index) => (
                  <div key={speaker} className="flex items-center space-x-2">
                    <div
                      className={`w-4 h-4 rounded-full ${speakerColors[speaker]}`}
                    ></div>
                    <span className="text-sm">Speaker {index}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filename and language */}
            <div className="p-3 border-b">
              <h2 className="text-lg font-bold">
                {file?.name || "Transcript"}
              </h2>
              <div className="text-xs text-gray-500 flex items-center space-x-2">
                <span>Norwegian</span>
                <span>•</span>
                <span>last month</span>
              </div>
            </div>

            {/* Transcript content with speakers */}
            <div className="divide-y max-h-[calc(100vh-26rem)] overflow-y-auto">
              {transcriptionResult.segments
                .reduce((groups, segment) => {
                  // Group segments by speaker consecutively
                  const lastGroup = groups[groups.length - 1];
                  if (lastGroup && lastGroup.speaker === segment.speaker) {
                    lastGroup.segments.push(segment);
                  } else {
                    groups.push({
                      speaker: segment.speaker,
                      segments: [segment],
                    });
                  }
                  return groups;
                }, [] as Array<{ speaker: string; segments: (typeof transcriptionResult.segments)[0][] }>)
                .map((group, groupIndex) => {
                  const speakerIndex = speakers.indexOf(group.speaker);
                  const firstSegment = group.segments[0];
                  const lastSegment = group.segments[group.segments.length - 1];

                  return (
                    <div key={groupIndex} className="p-3">
                      {/* Time range */}
                      <div className="text-xs text-gray-500 mb-1">
                        {formatTime(firstSegment.start)} -{" "}
                        {formatTime(lastSegment.end)}
                      </div>

                      {/* Speaker with icon */}
                      <div className="flex items-center space-x-2 mb-2">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            speakerColors[group.speaker]
                          }`}
                        >
                          <span className="text-xs">{speakerIndex}</span>
                        </div>
                        <span className="text-sm font-medium">
                          Speaker {speakerIndex}
                        </span>
                      </div>

                      {/* Text */}
                      <div className="text-sm pl-7">
                        {group.segments.map((seg) => seg.text).join(" ")}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Chatbot button */}
          <div className="mt-4 flex justify-end">
            <Button onClick={openChatInNewWindow} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Åpne chat med transkripsjonen
            </Button>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center p-12 border rounded-md mb-6 bg-muted/30">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Last opp en lydfil for å se transkripsjonen her
            </p>
          </div>
        )
      )}
    </div>
  );
}
