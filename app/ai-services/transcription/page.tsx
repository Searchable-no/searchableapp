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
    <div className="container max-w-7xl mx-auto p-4 md:p-8">
      <TranscriptionService />
    </div>
  );
}
