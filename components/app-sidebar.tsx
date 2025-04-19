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
} from "lucide-react";
import { useSession } from "@/lib/session";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

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
        title: "Chat",
        href: "/ai-services/chat",
        icon: MessageSquare,
      },
      {
        title: "Transcription",
        href: "/ai-services/transcription",
        icon: FileAudio,
      },
      { title: "Email", href: "/ai-services/email", icon: Mail },
    ],
  },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
];

// Admin navigation item that will be conditionally added
const adminNavItem: NavItem = { title: "Admin", href: "/admin", icon: Shield };

// Local storage key for sidebar collapsed state
const SIDEBAR_STATE_KEY = "sidebar:collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { session } = useSession();
  const [navItems, setNavItems] = useState([...navigation]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const supabase = createClientComponentClient();

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const storedState = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (storedState) {
      setCollapsed(storedState === "true");
    }
    setMounted(true);
  }, []);

  // Toggle collapsed state
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(SIDEBAR_STATE_KEY, String(newState));
  };

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
    <TooltipProvider>
      <div 
        className={cn(
          "flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out relative",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* Collapse/Expand Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-[72px] h-6 w-6 rounded-full bg-sidebar border border-sidebar-border z-10 shadow-md"
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronsRight className="h-3 w-3 text-sidebar-foreground/60" />
          ) : (
            <ChevronsLeft className="h-3 w-3 text-sidebar-foreground/60" />
          )}
        </Button>
      
        {/* Header with user info */}
        <div className={cn(
          "flex items-center gap-2 p-4 border-b border-sidebar-border overflow-hidden",
          collapsed && "justify-center"
        )}>
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Searchable-oEMTymeOqXxqDzlBGz8NHto1b6GOs0.png"
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-sidebar-foreground">
                {session.user.email?.split("@")[0] || "User"}
              </span>
              <span className="text-[10px] text-sidebar-foreground/60">
                {session.user.email}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className={cn("flex-1 space-y-0.5 p-3", collapsed && "items-center")}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const hasChildren = !!item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.href);

            if (hasChildren && !collapsed) {
              return (
                <React.Fragment key={item.href}>
                  <div>
                    <button
                      onClick={() => toggleExpand(item.href)}
                      className={`group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                          }`}
                        />
                        {item.title}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-sidebar-foreground/60" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-sidebar-foreground/60" />
                      )}
                    </button>

                    {isExpanded && item.children && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const isChildActive =
                            pathname === child.href ||
                            pathname.startsWith(child.href + "/");
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`group flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                                isChildActive
                                  ? "bg-sidebar-accent text-sidebar-primary"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                              }`}
                            >
                              <child.icon
                                className={`h-4 w-4 transition-colors ${
                                  isChildActive
                                    ? "text-sidebar-primary"
                                    : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                                }`}
                              />
                              {child.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            } else {
              return (
                <Tooltip key={item.href} delayDuration={collapsed ? 300 : 999999}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon
                        className={`h-4 w-4 transition-colors ${
                          isActive
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                        }`}
                      />
                      {!collapsed && item.title}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="text-xs">
                      {item.title}
                      {hasChildren && " (Menu)"}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            }
          })}
        </nav>

        {/* Footer with theme toggle and logout */}
        <div className={cn(
          "border-t border-sidebar-border p-3 space-y-0.5",
          collapsed && "flex flex-col items-center"
        )}>
          {mounted && (
            <Tooltip delayDuration={collapsed ? 300 : 999999}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const newTheme = theme === "light" ? "dark" : "light";
                    setTheme(newTheme);
                    // Store in localStorage as a backup
                    if (typeof window !== "undefined") {
                      localStorage.setItem("theme", newTheme);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors w-full",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4 text-sidebar-foreground/60" />
                  ) : (
                    <Sun className="h-4 w-4 text-sidebar-foreground/60" />
                  )}
                  {!collapsed && (theme === "light" ? "Dark mode" : "Light mode")}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </TooltipContent>
              )}
            </Tooltip>
          )}

          <Tooltip delayDuration={collapsed ? 300 : 999999}>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors w-full",
                  collapsed && "justify-center px-2"
                )}
              >
                <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
                {!collapsed && "Logout"}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="text-xs">
                Logout
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
