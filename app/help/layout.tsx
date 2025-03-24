import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Documentation - Searchable",
  description: "Documentation and guidance on using the Searchable application",
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1">
      {children}
    </main>
  );
} 