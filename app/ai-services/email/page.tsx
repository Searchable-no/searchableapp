"use client";

import dynamic from "next/dynamic";

// Use dynamic import to handle the client component
const EmailService = dynamic(
  () => import("../../../components/ai-services/email/EmailService"),
  { ssr: false }
);

export default function EmailPage() {
  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-8">
      <EmailService />
    </div>
  );
}
