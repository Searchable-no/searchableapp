"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase-browser";
import {
  SearchResults,
  SharePointSearchResult,
} from "@/components/SearchResults";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSharePointSites, type SharePointSite } from "@/lib/microsoft-graph";
import {
  Filter,
  X,
  FileType,
  Clock,
  Users,
  Search,
  FileText,
  Presentation,
  FileImage,
  Archive,
  FileSpreadsheet,
  File,
  FileCode,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  History,
  Mail,
  MessageSquare,
  ListTodo,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const fileTypes = [
  // Content Types
  {
    value: "email",
    label: "Emails",
    icon: <Mail className="h-4 w-4" />,
    color: "text-sky-400",
    isContentType: true,
  },
  {
    value: "teams",
    label: "Teams Chats",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-indigo-400",
    isContentType: true,
  },
  {
    value: "planner",
    label: "Tasks",
    icon: <ListTodo className="h-4 w-4" />,
    color: "text-rose-400",
    isContentType: true,
  },
  // File Types
  {
    value: "docx",
    label: "Word",
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-400",
    isContentType: false,
  },
  {
    value: "xlsx",
    label: "Excel",
    icon: <FileSpreadsheet className="h-4 w-4" />,
    color: "text-emerald-400",
    isContentType: false,
  },
  {
    value: "pptx",
    label: "PowerPoint",
    icon: <Presentation className="h-4 w-4" />,
    color: "text-orange-400",
    isContentType: false,
  },
  {
    value: "pdf",
    label: "PDF",
    icon: <File className="h-4 w-4" />,
    color: "text-red-400",
    isContentType: false,
  },
  {
    value: "txt",
    label: "Text",
    icon: <FileCode className="h-4 w-4" />,
    color: "text-slate-400",
    isContentType: false,
  },
  {
    value: "jpg",
    label: "Image",
    icon: <FileImage className="h-4 w-4" />,
    color: "text-violet-400",
    isContentType: false,
  },
  {
    value: "png",
    label: "Image",
    icon: <FileImage className="h-4 w-4" />,
    color: "text-violet-400",
    isContentType: false,
  },
  {
    value: "zip",
    label: "Archive",
    icon: <Archive className="h-4 w-4" />,
    color: "text-amber-400",
    isContentType: false,
  },
] as const;

const lastModifiedOptions = [
  {
    value: "24h",
    label: "24 hours",
    description: "Last day",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "7d",
    label: "7 days",
    description: "Last week",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    value: "30d",
    label: "30 days",
    description: "Last month",
    icon: <CalendarRange className="h-4 w-4" />,
  },
  {
    value: "90d",
    label: "90 days",
    description: "Last 3 months",
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    value: "all",
    label: "All time",
    description: "No filter",
    icon: <History className="h-4 w-4" />,
  },
] as const;

export default function NormalSearchPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SharePointSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useSession();
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [lastModified, setLastModified] = useState<string>("all");
  const [creators, setCreators] = useState<Set<string>>(new Set());
  const [selectedCreator, setSelectedCreator] = useState<string>("all");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  // Extract unique creators from results
  useEffect(() => {
    const uniqueCreators = new Set<string>();
    results.forEach((result) => {
      if (result.createdBy?.user?.displayName) {
        uniqueCreators.add(result.createdBy.user.displayName);
      }
    });
    setCreators(uniqueCreators);
  }, [results]);

  // Fetch workspace name if workspaceId is provided
  useEffect(() => {
    if (workspaceId && session?.user?.id) {
      const fetchWorkspaceName = async () => {
        try {
          const { data } = await supabase
            .from("workspaces")
            .select("name")
            .eq("id", workspaceId)
            .eq("user_id", session.user.id)
            .single();

          if (data) {
            setWorkspaceName(data.name);
          }
        } catch (error) {
          console.error("Error fetching workspace name:", error);
        }
      };

      fetchWorkspaceName();
    }
  }, [workspaceId, session?.user?.id]);

  // Fetch SharePoint sites when component mounts
  useEffect(() => {
    async function fetchSites() {
      if (!session?.user?.id) return;

      try {
        const sitesList = await getSharePointSites(session.user.id);
        setSites(sitesList);
      } catch (error) {
        console.error("Error fetching SharePoint sites:", error);
        setError("Failed to load SharePoint sites");
      }
    }

    fetchSites();
  }, [session?.user?.id]);

  // Filter results based on selected filters
  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      // Get selected content types and file types
      const selectedContentTypes = selectedFileTypes.filter((type) =>
        fileTypes.find((ft) => ft.value === type && ft.isContentType)
      );
      const selectedExtensions = selectedFileTypes.filter((type) =>
        fileTypes.find((ft) => ft.value === type && !ft.isContentType)
      );

      // Content type filter
      if (selectedContentTypes.length > 0) {
        const contentTypeMatch = selectedContentTypes.some((type) => {
          switch (type) {
            case "email":
              return result.type === "email";
            case "teams":
              return result.type === "chat" || result.type === "channel";
            case "planner":
              return result.type === "planner";
            default:
              return false;
          }
        });

        if (!contentTypeMatch) {
          return false;
        }
      }

      // File type filter (only apply to file types)
      if (selectedExtensions.length > 0 && result.type === "file") {
        const extension = result.name.split(".").pop()?.toLowerCase();
        if (!extension || !selectedExtensions.includes(extension)) {
          return false;
        }
      }

      // Last modified filter
      if (lastModified !== "all") {
        const modifiedDate = new Date(result.lastModifiedDateTime);
        const now = new Date();
        const diffInDays =
          (now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);

        switch (lastModified) {
          case "24h":
            if (diffInDays > 1) return false;
            break;
          case "7d":
            if (diffInDays > 7) return false;
            break;
          case "30d":
            if (diffInDays > 30) return false;
            break;
          case "90d":
            if (diffInDays > 90) return false;
            break;
        }
      }

      // Created by filter
      if (
        selectedCreator !== "all" &&
        result.createdBy?.user?.displayName !== selectedCreator
      ) {
        return false;
      }

      return true;
    });
  }, [results, selectedFileTypes, lastModified, selectedCreator]);

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedFileTypes.length > 0) count++;
    if (lastModified !== "all") count++;
    if (selectedCreator !== "all") count++;
    return count;
  }, [selectedFileTypes, lastModified, selectedCreator]);

  const handleSearch = async () => {
    if (!query.trim() || !session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // If we have a workspace ID, use the workspace search endpoint
      if (workspaceId) {
        const response = await fetch(
          `/api/search/with-workspace?query=${encodeURIComponent(
            query
          )}&workspace=${encodeURIComponent(workspaceId)}`
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setResults(data.data);
        if (data.workspace) {
          setWorkspaceName(data.workspace);
        }
      } else {
        // Use the regular search endpoint
        const response = await fetch(
          `/api/search/normal?q=${encodeURIComponent(
            query
          )}&userId=${encodeURIComponent(session.user.id)}${
            selectedSiteId !== "all"
              ? `&siteId=${encodeURIComponent(selectedSiteId)}`
              : ""
          }${
            selectedFileTypes.length > 0
              ? `&contentTypes=${encodeURIComponent(
                  selectedFileTypes.join(",")
                )}`
              : ""
          }`
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4">
        {/* Search Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg -m-0.5 blur-xl" />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 h-11 text-base bg-background/60 backdrop-blur-sm border border-border/50 hover:border-primary/50 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            {!workspaceId && (
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-[200px] h-11 bg-background/60 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all shadow-sm">
                  <SelectValue placeholder="All SharePoint sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SharePoint sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={activeFilterCount > 0 ? "default" : "outline"}
                  className={cn(
                    "h-11 px-4 gap-2 relative transition-all bg-background/60 backdrop-blur-sm border border-border/50",
                    activeFilterCount > 0 &&
                      "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-normal">Filter</span>
                  {activeFilterCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary ml-1">
                      {activeFilterCount}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-72 p-2"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup className="space-y-1">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10">
                      <FileType className="h-4 w-4" />
                      <span className="text-sm">File Type</span>
                      {selectedFileTypes.length > 0 && (
                        <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          {selectedFileTypes.length}
                        </div>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-56 p-1">
                        <div className="max-h-[300px] overflow-y-auto">
                          {fileTypes.map((type) => (
                            <DropdownMenuCheckboxItem
                              key={type.value}
                              checked={selectedFileTypes.includes(type.value)}
                              onCheckedChange={(checked) => {
                                setSelectedFileTypes((prev) =>
                                  checked
                                    ? [...prev, type.value]
                                    : prev.filter((t) => t !== type.value)
                                );
                              }}
                              className="gap-2 rounded-md data-[state=checked]:bg-primary/10"
                            >
                              <span className={cn("w-6", type.color)}>
                                {type.icon}
                              </span>
                              <span className="text-sm">{type.label}</span>
                            </DropdownMenuCheckboxItem>
                          ))}
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Time Range</span>
                      {lastModified !== "all" && (
                        <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          {
                            lastModifiedOptions.find(
                              (opt) => opt.value === lastModified
                            )?.label
                          }
                        </div>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-56 p-1">
                        <DropdownMenuRadioGroup
                          value={lastModified}
                          onValueChange={setLastModified}
                        >
                          {lastModifiedOptions.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.value}
                              value={option.value}
                              className="gap-2 rounded-md data-[state=checked]:bg-primary/10"
                            >
                              <span>{option.icon}</span>
                              <div className="flex flex-col">
                                <span className="text-sm">{option.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {creators.size > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Created By</span>
                        {selectedCreator !== "all" && (
                          <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs truncate max-w-[100px]">
                            {selectedCreator}
                          </div>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-56 p-1">
                          <DropdownMenuRadioGroup
                            value={selectedCreator}
                            onValueChange={setSelectedCreator}
                          >
                            <DropdownMenuRadioItem
                              value="all"
                              className="rounded-md data-[state=checked]:bg-primary/10"
                            >
                              <span className="text-sm">All Users</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuSeparator className="my-1" />
                            <div className="max-h-[200px] overflow-y-auto">
                              {Array.from(creators).map((creator) => (
                                <DropdownMenuRadioItem
                                  key={creator}
                                  value={creator}
                                  className="truncate rounded-md data-[state=checked]:bg-primary/10"
                                >
                                  <span className="text-sm">{creator}</span>
                                </DropdownMenuRadioItem>
                              ))}
                            </div>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuGroup>

                {activeFilterCount > 0 && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground gap-2 rounded-md hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setSelectedFileTypes([]);
                        setLastModified("all");
                        setSelectedCreator("all");
                      }}
                    >
                      <X className="h-4 w-4" />
                      <span className="text-sm">Clear filters</span>
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleSearch}
              className="h-11 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm font-normal">Search</span>
            </Button>
          </div>
        </div>

        {/* Workspace filter indicator */}
        {workspaceName && (
          <div className="flex items-center gap-2 bg-primary/10 py-2 px-4 rounded-md">
            <span className="text-sm font-medium">
              Searching in workspace:{" "}
              <span className="font-bold">{workspaceName}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2"
              onClick={() => {
                window.location.href = "/search/normal";
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear filter
            </Button>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 items-center py-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-xs font-medium text-muted-foreground">
              Filters:
            </span>
            {selectedFileTypes.map((type) => {
              const fileType = fileTypes.find((t) => t.value === type);
              return (
                <Badge
                  key={type}
                  variant="secondary"
                  className="h-7 gap-1.5 pl-2 pr-1 bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
                >
                  <span className={fileType?.color}>{fileType?.icon}</span>
                  <span className="text-xs">{fileType?.label}</span>
                  <X
                    className="h-3 w-3 ml-0.5 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                    onClick={() =>
                      setSelectedFileTypes((prev) =>
                        prev.filter((t) => t !== type)
                      )
                    }
                  />
                </Badge>
              );
            })}
            {lastModified !== "all" && (
              <Badge
                variant="secondary"
                className="h-7 gap-1.5 pl-2 pr-1 bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
              >
                <Clock className="h-3 w-3" />
                <span className="text-xs">
                  {
                    lastModifiedOptions.find(
                      (opt) => opt.value === lastModified
                    )?.label
                  }
                </span>
                <X
                  className="h-3 w-3 ml-0.5 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                  onClick={() => setLastModified("all")}
                />
              </Badge>
            )}
            {selectedCreator !== "all" && (
              <Badge
                variant="secondary"
                className="h-7 gap-1.5 pl-2 pr-1 bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
              >
                <Users className="h-3 w-3" />
                <span className="text-xs">{selectedCreator}</span>
                <X
                  className="h-3 w-3 ml-0.5 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                  onClick={() => setSelectedCreator("all")}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      <SearchResults
        results={filteredResults}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
