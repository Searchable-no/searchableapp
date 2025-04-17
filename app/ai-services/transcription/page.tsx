"use client";

import dynamic from "next/dynamic";

// Use dynamic import to handle the client component
const TranscriptionService = dynamic(
  () =>
    import(
      "../../../components/ai-services/transcription/TranscriptionService"
    ),
  { ssr: false }
);

export default function TranscriptionPage() {
  return (
    <div className="w-full h-full p-4 md:p-6">
      <TranscriptionService />
    </div>
  );
}
