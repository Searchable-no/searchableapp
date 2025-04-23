import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/Toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import "./globals.css";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Searchable",
  description: "A search-enabled dashboard for your workspace",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Searchable",
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <OrganizationProvider>
            <div className="flex min-h-screen">
              {session && <AppSidebar />}
              <div className="flex-1 overflow-auto w-full">{children}</div>
            </div>
            <Toaster />
          </OrganizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
