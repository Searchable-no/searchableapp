"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useSession } from "@/lib/session";

const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { title: "Search", href: "/search", icon: Search },
  { title: "Normal Search", href: "/search/normal", icon: Search },
  { title: "Files", href: "/files", icon: FileText },
  { title: "Chats", href: "/chats", icon: MessageSquare },
  { title: "CRM", href: "/crm", icon: Users },
  { title: "Help", href: "/help", icon: HelpCircle },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { session } = useSession();

  // Prevent hydration mismatch by only rendering theme switch after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // If no session, don't render the sidebar
  if (!session) {
    return null;
  }

  return (
    <div className="flex h-full w-[280px] flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Searchable-oEMTymeOqXxqDzlBGz8NHto1b6GOs0.png"
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">
            {session.user.email?.split("@")[0] || "User"}
          </span>
          <span className="text-xs text-sidebar-foreground/60">
            {session.user.email}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon
                className={`h-5 w-5 transition-colors ${
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                }`}
              />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-1">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5 text-sidebar-foreground/60" />
            ) : (
              <Sun className="h-5 w-5 text-sidebar-foreground/60" />
            )}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        )}

        <Link
          href="/logout"
          className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-5 w-5 text-sidebar-foreground/60" />
          Logout
        </Link>
      </div>
    </div>
  );
}
