"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  HelpCircle,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Layout,
  Shield,
  FolderKanban,
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileAudio,
  Mail,
  Newspaper,
  ChevronsLeft,
  ChevronsRight,
  Menu,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { cn } from "@/lib/utils";

type NavItemChild = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItemChild[];
};

const navigation: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { title: "Search", href: "/search/normal", icon: Search },
  { title: "Workspaces", href: "/workspaces", icon: Layout },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  {
    title: "AI Services",
    href: "/ai-services",
    icon: Sparkles,
    children: [
      {
        title: "Transcription",
        href: "/ai-services/transcription",
        icon: FileAudio,
      },
      { title: "Email", href: "/ai-services/email", icon: Mail },
      { title: "AI News", href: "/ai-services/ai-news", icon: Newspaper },
    ],
  },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
];

// Admin navigation item that will be conditionally added
const adminNavItem: NavItem = { title: "Admin", href: "/admin", icon: Shield };

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { session } = useSession();
  const [navItems, setNavItems] = useState([...navigation]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = createClientComponentClient();

  // Check if AI Services section should be expanded based on current path
  useEffect(() => {
    if (pathname.startsWith("/ai-services")) {
      setExpandedItems((prev) =>
        prev.includes("/ai-services") ? prev : [...prev, "/ai-services"]
      );
    }
  }, [pathname]);

  // Load sidebar collapsed state from localStorage on mount
  useEffect(() => {
    const storedState = localStorage.getItem("sidebar-collapsed");
    if (storedState !== null) {
      setIsCollapsed(storedState === "true");
    }
  }, []);

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", isCollapsed.toString());
  }, [isCollapsed]);

  // Toggle collapsed state
  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close mobile menu on navigation (for small screens)
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Toggle expanded state for navigation items with children
  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  // Check if current user is admin
  useEffect(() => {
    if (!session?.user?.id) return;

    const checkAdminStatus = async () => {
      try {
        console.log("Checking admin status for:", session.user.id);

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error checking admin status:", error);
          return;
        }

        console.log("Admin status:", profile?.is_admin);

        if (profile?.is_admin) {
          setNavItems((prev) => {
            // Only add the admin nav item if it doesn't already exist
            if (!prev.find((item) => item.href === "/admin")) {
              return [...navigation, adminNavItem];
            }
            return prev;
          });
        }
      } catch (error) {
        console.error("Error in admin check:", error);
      }
    };

    checkAdminStatus();

    // Subscribe to profile changes
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log("Profile updated:", payload);
          // Check if is_admin field was updated
          if (payload.new && payload.new.is_admin !== undefined) {
            if (payload.new.is_admin) {
              setNavItems((prev) => {
                if (!prev.find((item) => item.href === "/admin")) {
                  return [...navigation, adminNavItem];
                }
                return prev;
              });
            } else {
              setNavItems(navigation);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, supabase]);

  // Prevent hydration mismatch by only rendering theme switch after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // If no session, don't render the sidebar
  if (!session) {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile menu button - visible only on small screens */}
      <button
        className="fixed z-50 top-4 left-4 p-2 rounded-md bg-background shadow-md border md:hidden"
        onClick={toggleMobileMenu}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[70px]" : "w-[220px]",
          "fixed md:relative z-40 h-screen",
          // Mobile responsive behavior
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="text-xl font-semibold tracking-tight"
                >
                  Searchable
                </Link>
              </div>
            </>
          )}
          <button
            onClick={toggleCollapsed}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
              isCollapsed && "ml-auto"
            )}
          >
            {isCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="content-scrollable flex-1 px-2 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.href);

              return (
                <div key={item.href} className="mb-1">
                  {hasChildren ? (
                    <button
                      className={cn(
                        "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                        isCollapsed && "justify-center"
                      )}
                      onClick={() => toggleExpand(item.href)}
                    >
                      <item.icon
                        className={cn("h-5 w-5", isCollapsed ? "" : "mr-2")}
                      />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.title}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <item.icon
                        className={cn("h-5 w-5", isCollapsed ? "" : "mr-2")}
                      />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  )}

                  {/* Render children if expanded and not collapsed */}
                  {hasChildren && isExpanded && !isCollapsed && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children?.map((child) => {
                        const isChildActive =
                          pathname === child.href ||
                          pathname.startsWith(`${child.href}/`);

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                              isChildActive
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <child.icon className="mr-2 h-4 w-4" />
                            <span>{child.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer with theme toggle and logout */}
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center justify-between">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "ml-auto mr-auto"
                )}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
            {!isCollapsed && mounted && (
              <button
                onClick={handleLogout}
                className="inline-flex h-8 items-center justify-center rounded-md px-3 hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            )}
            {isCollapsed && (
              <button
                onClick={handleLogout}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
