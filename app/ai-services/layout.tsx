import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tjenester | Searchable",
  description: "AI tjenester for transkribering, oppsummering og mer",
};

export default function AIServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
