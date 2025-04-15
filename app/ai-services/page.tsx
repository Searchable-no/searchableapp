import { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

// Use dynamic import to handle the client component
const TranscriptionService = dynamic(
  () =>
    import("../../components/ai-services/transcription/TranscriptionService"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "AI Tjenester | Searchable",
  description: "AI tjenester for transkribering, oppsummering og mer",
};

export default function AIServicesPage() {
  redirect("/ai-services/transcription");
}
