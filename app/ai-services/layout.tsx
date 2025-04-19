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
  return <>{children}</>;
} 