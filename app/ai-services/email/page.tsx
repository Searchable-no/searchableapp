"use client";

import dynamic from "next/dynamic";

// Use dynamic import to handle the client component
const EmailService = dynamic(
  () => import("../../../components/ai-services/email/EmailService"),
  { ssr: false }
);

export default function EmailPage() {
  return (
    <div className="w-full h-full p-4 md:p-6">
      <EmailService />
    </div>
  );
}
