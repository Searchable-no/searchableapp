"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

// Modified cache structure to include timestamp
interface CachedSearchResult {
  results: SharePointSearchResult[];
  timestamp: number;
  refreshing: boolean;
}

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>(
    []
  );
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(
    workspaceId || "all"
  );
  const [cachedResults, setCachedResults] = useState<{
    [key: string]: CachedSearchResult;
  }>({});
  const [initialResultsLoaded, setInitialResultsLoaded] = useState(false);
  const [searchTimerId, setSearchTimerId] = useState<NodeJS.Timeout | null>(
    null
  );
  const [progressiveLoadingPercent, setProgressiveLoadingPercent] = useState(0);

  useEffect(() => {
    const savedSearches = localStorage.getItem("recentSearches");
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches).slice(0, 5));
      } catch (e) {
        console.error("Failed to parse recent searches:", e);
      }
    }
  }, []);

  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const newRecentSearches = [
      searchQuery,
      ...recentSearches.filter((s) => s !== searchQuery),
    ].slice(0, 5);

    setRecentSearches(newRecentSearches);
    localStorage.setItem("recentSearches", JSON.stringify(newRecentSearches));
  };

  useEffect(() => {
    const uniqueCreators = new Set<string>();
    results.forEach((result) => {
      if (result.createdBy?.user?.displayName) {
        uniqueCreators.add(result.createdBy.user.displayName);
      }
    });
    setCreators(uniqueCreators);
  }, [results]);

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

  useEffect(() => {
    async function fetchWorkspaces() {
      if (!session?.user?.id) return;

      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("user_id", session.user.id);

        if (error) {
          throw error;
        }

        if (data) {
          setWorkspaces(data);
        }
      } catch (error) {
        console.error("Error fetching workspaces:", error);
      }
    }

    fetchWorkspaces();
  }, [session?.user?.id]);

  useEffect(() => {
    const savedCache = localStorage.getItem("searchResultsCache");
    if (savedCache) {
      try {
        setCachedResults(JSON.parse(savedCache));
      } catch (e) {
        console.error("Failed to parse cached results:", e);
      }
    }
  }, []);

  // Add back the localStorage saving effect with updates for new cache structure
  useEffect(() => {
    if (Object.keys(cachedResults).length > 0) {
      const cacheEntries = Object.entries(cachedResults);
      const recentEntries = cacheEntries.slice(
        Math.max(0, cacheEntries.length - 10)
      );
      const trimmedCache = Object.fromEntries(recentEntries);

      try {
        localStorage.setItem(
          "searchResultsCache",
          JSON.stringify(trimmedCache)
        );
      } catch (e) {
        console.error("Failed to save cache to localStorage:", e);
      }
    }
  }, [cachedResults]);

  const createCacheKey = useCallback(() => {
    return JSON.stringify({
      query: query.toLowerCase().trim(),
      siteId: selectedSiteId,
      workspaceId: selectedWorkspace,
      fileTypes: selectedFileTypes.sort(),
      timeRange: lastModified,
      creator: selectedCreator,
    });
  }, [
    query,
    selectedSiteId,
    selectedWorkspace,
    selectedFileTypes,
    lastModified,
    selectedCreator,
  ]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !session?.user?.id) return;

    const cacheKey = createCacheKey();
    const now = Date.now();
    const cachedItem = cachedResults[cacheKey] as
      | CachedSearchResult
      | undefined;

    // Check if we have a recent cache (less than 5 minutes old) and it's not already refreshing
    const isCacheRecent =
      cachedItem && now - cachedItem.timestamp < 5 * 60 * 1000;
    const isAlreadyRefreshing = cachedItem?.refreshing === true;

    // If cache is recent (under 5 minutes) and not already refreshing, just use it without background refresh
    if (isCacheRecent && !isAlreadyRefreshing) {
      setResults(cachedItem.results);
      setInitialResultsLoaded(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    saveRecentSearch(query);

    setProgressiveLoadingPercent(0);

    const progressInterval = setInterval(() => {
      setProgressiveLoadingPercent((prev) => {
        const increment = prev < 30 ? 7 : prev < 60 ? 3 : prev < 85 ? 1 : 0.5;
        const newValue = prev + increment;
        return newValue > 90 ? 90 : newValue;
      });
    }, 100);

    if (searchTimerId) {
      clearTimeout(searchTimerId);
      setSearchTimerId(null);
    }

    if (cachedItem) {
      // Mark this cache item as currently refreshing
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: {
          ...cachedItem,
          refreshing: true,
        },
      }));

      // Show cached results immediately
      setResults(cachedItem.results);
      setInitialResultsLoaded(true);

      // Fetch fresh results after a short delay
      const timer = setTimeout(async () => {
        try {
          await performSearch();
        } catch (error) {
          console.error("Background refresh error:", error);
          // Reset refreshing flag if there was an error
          setCachedResults((prev) => ({
            ...prev,
            [cacheKey]: {
              ...cachedItem,
              refreshing: false,
            },
          }));
        }
      }, 1000);
      setSearchTimerId(timer);
    } else {
      try {
        await performSearch();
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      }
    }

    return () => clearInterval(progressInterval);

    async function performSearch() {
      if (!session || !session.user?.id) return;

      try {
        let searchResults: SharePointSearchResult[] = [];

        if (selectedWorkspace !== "all" && selectedWorkspace) {
          const response = await fetch(
            `/api/search/with-workspace?query=${encodeURIComponent(
              query
            )}&workspace=${encodeURIComponent(selectedWorkspace)}`
          );

          if (!response.ok) {
            throw new Error("Search failed");
          }

          const data = await response.json();
          searchResults = data.data;
          if (data.workspace) {
            setWorkspaceName(data.workspace);
          }
        } else {
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
          searchResults = data.results;
        }

        // Store results with current timestamp and reset refreshing flag
        setCachedResults((prev) => ({
          ...prev,
          [cacheKey]: {
            results: searchResults,
            timestamp: Date.now(),
            refreshing: false,
          },
        }));

        setResults(searchResults);
        setProgressiveLoadingPercent(100);
        setInitialResultsLoaded(true);
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    query,
    session,
    selectedSiteId,
    selectedWorkspace,
    selectedFileTypes,
    createCacheKey,
    cachedResults,
    searchTimerId,
    saveRecentSearch,
  ]);

  const debouncedSearch = useCallback(
    debounce(() => {
      if (query.trim().length >= 3) {
        handleSearch();
      }
    }, 400),
    [handleSearch]
  );

  useEffect(() => {
    if (query.trim().length >= 3) {
      debouncedSearch();
    }

    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): T & { cancel: () => void } {
    let timeout: NodeJS.Timeout | null = null;

    const debounced = (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };

    debounced.cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    return debounced as T & { cancel: () => void };
  }

  const filteredResults = useMemo(() => {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    return results.filter((result) => {
      const selectedContentTypes = selectedFileTypes.filter((type) =>
        fileTypes.find((ft) => ft.value === type && ft.isContentType)
      );
      const selectedExtensions = selectedFileTypes.filter((type) =>
        fileTypes.find((ft) => ft.value === type && !ft.isContentType)
      );

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

      if (selectedExtensions.length > 0 && result.type === "file") {
        const extension = result.name.split(".").pop()?.toLowerCase();
        if (!extension || !selectedExtensions.includes(extension)) {
          return false;
        }
      }

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

      if (
        selectedCreator !== "all" &&
        result.createdBy?.user?.displayName !== selectedCreator
      ) {
        return false;
      }

      return true;
    });
  }, [results, selectedFileTypes, lastModified, selectedCreator]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedFileTypes.length > 0) count++;
    if (lastModified !== "all") count++;
    if (selectedCreator !== "all") count++;
    if (selectedWorkspace !== "all") count++;
    return count;
  }, [selectedFileTypes, lastModified, selectedCreator, selectedWorkspace]);

  const handleWorkspaceChange = (value: string) => {
    setSelectedWorkspace(value);

    if (value !== "all") {
      window.location.href = `/search/normal?workspace=${value}`;
    } else if (workspaceId) {
      window.location.href = "/search/normal";
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">
          Searchable
        </h1>
        <p className="text-muted-foreground mt-1">
          Search across all your files, documents, and content
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start gap-3">
            <div className="flex-1 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl -m-1 blur-md" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for files, emails, documents..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    } else {
                      setShowRecentSearches(true);
                    }
                  }}
                  onFocus={() => setShowRecentSearches(true)}
                  className="pl-12 pr-4 py-6 h-14 text-base bg-background shadow-sm border border-border/50 hover:border-primary/50 focus:border-primary rounded-lg transition-all"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                {showRecentSearches && recentSearches.length > 0 && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 bg-background border border-border/60 rounded-lg shadow-md z-10 overflow-hidden"
                    onMouseLeave={() => setShowRecentSearches(false)}
                  >
                    <div className="py-1.5 px-3 bg-muted/50 border-b border-border/60 flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        Recent Searches
                      </span>
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setRecentSearches([]);
                          localStorage.removeItem("recentSearches");
                          setShowRecentSearches(false);
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="py-1 max-h-60 overflow-y-auto">
                      {recentSearches.map((search, index) => (
                        <button
                          key={index}
                          className="w-full px-4 py-2.5 text-left hover:bg-muted/80 flex items-center gap-3 text-sm"
                          onClick={() => {
                            setQuery(search);
                            setShowRecentSearches(false);
                            handleSearch();
                          }}
                        >
                          <History className="h-4 w-4 text-muted-foreground" />
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-14 px-4 gap-2 relative transition-all rounded-lg shadow-sm border border-border/50 hover:border-primary/50 w-[220px]"
                  >
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm truncate">
                      {selectedWorkspace !== "all"
                        ? workspaces.find((w) => w.id === selectedWorkspace)
                            ?.name || "Workspace"
                        : "All Workspaces"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[220px] p-2"
                  align="start"
                  sideOffset={8}
                >
                  <DropdownMenuRadioGroup
                    value={selectedWorkspace}
                    onValueChange={handleWorkspaceChange}
                  >
                    <DropdownMenuRadioItem
                      value="all"
                      className="rounded-md cursor-pointer"
                    >
                      All Workspaces
                    </DropdownMenuRadioItem>

                    {workspaces.length > 0 && <DropdownMenuSeparator />}

                    {workspaces.map((workspace) => (
                      <DropdownMenuRadioItem
                        key={workspace.id}
                        value={workspace.id}
                        className="rounded-md cursor-pointer truncate"
                      >
                        {workspace.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {!workspaceId && (
                <Select
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                >
                  <SelectTrigger className="w-[200px] h-14 bg-background shadow-sm border border-border/50 hover:border-primary/50 transition-all rounded-lg">
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
                      "h-14 px-4 gap-2.5 relative transition-all rounded-lg shadow-sm border border-border/50",
                      activeFilterCount > 0 &&
                        "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    <Filter className="h-5 w-5" />
                    <span className="text-sm font-medium">Filters</span>
                    {activeFilterCount > 0 && (
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary ml-1">
                        {activeFilterCount}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-80 p-2"
                  align="end"
                  sideOffset={8}
                >
                  <div className="mb-2 pb-2 border-b border-border/60">
                    <h4 className="font-medium text-sm px-2 py-1.5">
                      Filter Results
                    </h4>
                  </div>
                  <DropdownMenuGroup className="space-y-1">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10 p-2.5">
                        <FileType className="h-4 w-4" />
                        <span className="text-sm">File Type</span>
                        {selectedFileTypes.length > 0 && (
                          <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                            {selectedFileTypes.length}
                          </div>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-60 p-1">
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
                                className="gap-2 rounded-md data-[state=checked]:bg-primary/10 p-2"
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
                      <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10 p-2.5">
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
                        <DropdownMenuSubContent className="w-60 p-1">
                          <DropdownMenuRadioGroup
                            value={lastModified}
                            onValueChange={setLastModified}
                          >
                            {lastModifiedOptions.map((option) => (
                              <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                className="gap-2 rounded-md data-[state=checked]:bg-primary/10 p-2"
                              >
                                <span>{option.icon}</span>
                                <div className="flex flex-col">
                                  <span className="text-sm">
                                    {option.label}
                                  </span>
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
                        <DropdownMenuSubTrigger className="gap-2 rounded-md data-[state=open]:bg-primary/10 p-2.5">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">Created By</span>
                          {selectedCreator !== "all" && (
                            <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs truncate max-w-[100px]">
                              {selectedCreator}
                            </div>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-60 p-1">
                            <DropdownMenuRadioGroup
                              value={selectedCreator}
                              onValueChange={setSelectedCreator}
                            >
                              <DropdownMenuRadioItem
                                value="all"
                                className="rounded-md data-[state=checked]:bg-primary/10 p-2"
                              >
                                <span className="text-sm">All Users</span>
                              </DropdownMenuRadioItem>
                              <DropdownMenuSeparator className="my-1" />
                              <div className="max-h-[200px] overflow-y-auto">
                                {Array.from(creators).map((creator) => (
                                  <DropdownMenuRadioItem
                                    key={creator}
                                    value={creator}
                                    className="truncate rounded-md data-[state=checked]:bg-primary/10 p-2"
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
                      <DropdownMenuSeparator className="my-2" />
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
                        <span className="text-sm">Clear all filters</span>
                      </Button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleSearch}
                className="h-14 px-5 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg"
              >
                <Search className="h-5 w-5" />
                <span className="text-sm font-medium">Search</span>
              </Button>
            </div>
          </div>

          {workspaceName && (
            <div className="flex items-center gap-2 bg-primary/10 py-2.5 px-4 rounded-lg shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
              <span className="text-sm font-medium">
                Searching in workspace:{" "}
                <span className="font-bold">{workspaceName}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 px-2 hover:bg-background/80"
                onClick={() => {
                  window.location.href = "/search/normal";
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear filter
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="w-full h-1 bg-muted overflow-hidden rounded-full">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progressiveLoadingPercent}%` }}
              />
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center py-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-xs font-medium text-muted-foreground">
                Filters:
              </span>
              {selectedWorkspace !== "all" && !workspaceId && (
                <Badge
                  variant="secondary"
                  className="h-7 gap-1.5 pl-2 pr-1 bg-background shadow-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
                >
                  <Users className="h-3 w-3" />
                  <span className="text-xs">
                    {workspaces.find((w) => w.id === selectedWorkspace)?.name ||
                      "Workspace"}
                  </span>
                  <button
                    className="ml-0.5 rounded-full h-4 w-4 inline-flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted transition-all"
                    onClick={() => handleWorkspaceChange("all")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedFileTypes.map((type: string) => {
                const fileType = fileTypes.find((t) => t.value === type);
                return (
                  <Badge
                    key={type}
                    variant="secondary"
                    className="h-7 gap-1.5 pl-2 pr-1 bg-background shadow-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
                  >
                    <span className={fileType?.color}>{fileType?.icon}</span>
                    <span className="text-xs">{fileType?.label}</span>
                    <button
                      className="ml-0.5 rounded-full h-4 w-4 inline-flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted transition-all"
                      onClick={() =>
                        setSelectedFileTypes((prev) =>
                          prev.filter((t) => t !== type)
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {lastModified !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-7 gap-1.5 pl-2 pr-1 bg-background shadow-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
                >
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">
                    {
                      lastModifiedOptions.find(
                        (opt) => opt.value === lastModified
                      )?.label
                    }
                  </span>
                  <button
                    className="ml-0.5 rounded-full h-4 w-4 inline-flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted transition-all"
                    onClick={() => setLastModified("all")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCreator !== "all" && (
                <Badge
                  variant="secondary"
                  className="h-7 gap-1.5 pl-2 pr-1 bg-background shadow-sm border border-border/50 hover:bg-secondary/80 transition-colors group"
                >
                  <Users className="h-3 w-3" />
                  <span className="text-xs">{selectedCreator}</span>
                  <button
                    className="ml-0.5 rounded-full h-4 w-4 inline-flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted transition-all"
                    onClick={() => setSelectedCreator("all")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {query && (
          <div className="mt-2 animate-in fade-in duration-300">
            {isLoading && !initialResultsLoaded ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground mb-1">
                  Searching for &quot;{query}&quot;...
                </p>
                <p className="text-xs text-muted-foreground">
                  {progressiveLoadingPercent < 30
                    ? "Connecting to search service..."
                    : progressiveLoadingPercent < 60
                    ? "Searching your documents and emails..."
                    : "Almost there, processing results..."}
                </p>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <X className="h-5 w-5" />
                  <h3>Search Error</h3>
                </div>
                <p>{error}</p>
                <Button
                  variant="outline"
                  className="mt-3 bg-background hover:bg-background/90"
                  onClick={() => handleSearch()}
                >
                  Try Again
                </Button>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  We couldn&apos;t find anything matching &quot;{query}&quot;.
                  Try using different keywords or filters.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                    }}
                  >
                    Clear Search
                  </Button>
                  {(selectedFileTypes.length > 0 ||
                    lastModified !== "all" ||
                    selectedCreator !== "all") && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedFileTypes([]);
                        setLastModified("all");
                        setSelectedCreator("all");
                        handleSearch();
                      }}
                    >
                      Clear Filters & Search Again
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {isLoading &&
                  initialResultsLoaded &&
                  cachedResults[createCacheKey()]?.refreshing && (
                    <div className="bg-primary/5 text-primary text-sm p-2 rounded-md mb-4 flex items-center">
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                      Showing saved results while refreshing...
                    </div>
                  )}
                <SearchResults
                  results={filteredResults}
                  isLoading={false}
                  error={error}
                />
              </>
            )}
          </div>
        )}

        {!query && !isLoading && results.length === 0 && (
          <div className="text-center pt-8 pb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
              <Search className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-medium mb-3">Search your content</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Enter keywords to search across your emails, files, documents, and
              more. Use filters to narrow down your results.
            </p>
            {recentSearches.length > 0 && (
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Recent searches:
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      className="px-3 py-1.5 bg-background border border-border/60 rounded-full text-sm hover:border-primary/40 transition-colors"
                      onClick={() => {
                        setQuery(search);
                        handleSearch();
                      }}
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
