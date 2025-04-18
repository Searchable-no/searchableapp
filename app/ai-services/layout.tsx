import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Tjenester | Searchable",
  description: "AI tjenester for transkribering, oppsummering og mer",
};

export default function AIServicesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
} 