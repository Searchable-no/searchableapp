"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Mail,
  FileText,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import debounce from "lodash/debounce";
import { useSession } from "@/lib/session";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AutocompleteResult {
  title: string;
  url: string;
  type: string;
  source: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  url: string | null;
  lastModified: string;
  type: "email" | "document";
  source: "microsoft" | "google";
  score: number;
}

interface SearchCategory {
  category: string;
  source: string;
  type: string;
  count: number;
  items: SearchResult[];
}

interface SearchResults {
  totalCount: number;
  categories: SearchCategory[];
  query: string;
  dateRange: string;
}

// Source icon mapping
const sourceIcons = {
  email: Mail,
  document: FileText,
};

// Add this utility function to clean HTML content
const cleanHtmlContent = (content: string): string => {
  // Skip cleaning if content is empty
  if (!content) return "";

  try {
    // If the content contains SharePoint metadata, return empty string
    if (
      content.includes('"vanityUrls"') ||
      content.includes('"multiGeoInfo"')
    ) {
      return "";
    }

    // Remove CSS and style blocks
    const withoutCSS = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Remove media queries and other CSS rules
    const withoutMediaQueries = withoutCSS.replace(
      /@media[^{]*{[\s\S]*?}/gi,
      ""
    );

    // Remove JavaScript
    const withoutJS = withoutMediaQueries
      .replace(/var\s+[_$a-zA-Z][_$a-zA-Z0-9]*\s*=\s*\{[^}]*\};?/g, "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Extract text from HTML while preserving some structure
    const withoutTags = withoutJS
      .replace(/<(br|p|div|h\d)[^>]*>/gi, "\n") // Replace block elements with newlines
      .replace(/<li[^>]*>/gi, "\n• ") // Replace list items with bullets
      .replace(/<[^>]*>/g, "") // Remove remaining HTML tags
      .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
      .replace(/\n{3,}/g, "\n\n"); // Reduce multiple newlines

    // Decode HTML entities
    const decoded = withoutTags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();

    return decoded;
  } catch (error) {
    console.error("Error cleaning content:", error);
    return "";
  }
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [results, setResults] = useState<SearchResults>({
    totalCount: 0,
    categories: [],
    query: "",
    dateRange: "all",
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
  } = useSession();
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setShowSuggestions(window.innerWidth >= 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (results.totalCount > 0) {
      handleSearch();
    }
  }, [source, dateRange]);

  const fetchSuggestions = useCallback(
    debounce(async (input: string) => {
      if (!input.trim() || !session?.user?.id) return;

      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(
            input
          )}&userId=${encodeURIComponent(session.user.id)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }
        const data = await response.json();
        setSuggestions(
          data.results.map((result: AutocompleteResult) => result.title)
        );
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    }, 300),
    [session]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      setQuery(suggestions[selectedSuggestionIndex]);
      setShowSuggestions(false);
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch();
  };

  const handleClearInput = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setResults({
      totalCount: 0,
      categories: [],
      query: "",
      dateRange: "all",
    });
  };

  const handleSearch = async () => {
    if (!query.trim() || !session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${window.location.origin}/api/search?q=${encodeURIComponent(
          query
        )}&userId=${encodeURIComponent(
          session.user.id
        )}&source=${source}&date=${dateRange}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !showSuggestions) {
      handleSearch();
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="bg-blue-100 text-blue-900 font-medium">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowSuggestions(false);
      setSuggestions([]);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Show loading state while session is being fetched
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Show error state if session loading failed
  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            Error loading session
          </h2>
          <p className="text-muted-foreground">{sessionError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Hero Section - Only show when no results */}
        {!results.totalCount && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-20"
          >
            <h1 className="text-6xl sm:text-7xl font-extrabold mb-8 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">
                Searchable
              </span>
            </h1>
          </motion.div>
        )}

        {/* Search Section */}
        <div className="relative z-10 flex flex-col gap-4 w-full max-w-4xl mx-auto">
          {/* Search Input */}
          <div className="relative w-full">
            <div className="relative">
              <Input
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onKeyPress={handleKeyPress}
                placeholder="Search emails, documents, and more..."
                className="w-full pl-12 pr-12 py-3 text-lg rounded-xl border-input focus:border-primary focus:ring-primary"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              {query && (
                <button
                  onClick={handleClearInput}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 right-0 mt-2 py-2 bg-background rounded-lg shadow-lg border border-border max-h-60 overflow-auto z-50"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full px-4 py-2 text-left hover:bg-muted ${
                        index === selectedSuggestionIndex
                          ? "bg-muted"
                          : "bg-background"
                      }`}
                    >
                      {highlightMatch(suggestion, query)}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filters */}
          <div className="flex gap-4 w-full">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="microsoft">Microsoft</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="recent">Last 7 Days</SelectItem>
                <SelectItem value="last-week">Last 14 Days</SelectItem>
                <SelectItem value="last-month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Section */}
        {results.totalCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 w-full"
          >
            <div className="text-sm text-muted-foreground mb-4">
              Found {results.totalCount} results
            </div>

            <div className="space-y-8 w-full">
              {results.categories.map((category) => (
                <div
                  key={`${category.source}-${category.type}`}
                  className="w-full"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        category.source === "microsoft"
                          ? "bg-primary text-primary-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }`}
                    >
                      {sourceIcons[
                        category.type as keyof typeof sourceIcons
                      ] && (
                        <div className="h-4 w-4">
                          {React.createElement(
                            sourceIcons[
                              category.type as keyof typeof sourceIcons
                            ]
                          )}
                        </div>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {category.category} ({category.count})
                    </h2>
                  </div>

                  <div className="grid gap-4 w-full">
                    {category.items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-background rounded-lg shadow-sm border border-border p-4 w-full hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-medium mb-2 text-foreground">
                                {highlightMatch(item.title, query)}
                              </h3>
                              <button
                                className="p-1 hover:bg-muted rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(item);
                                }}
                              >
                                <Maximize2 className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </div>
                            {item.title.endsWith(".pdf") && (
                              <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                  <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      clipRule="evenodd"
                                      d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                  PDF Document
                                </span>
                              </div>
                            )}
                            {cleanHtmlContent(item.content) && (
                              <div className="bg-muted rounded-lg p-3 mb-3">
                                <p className="text-sm text-foreground leading-relaxed">
                                  {highlightMatch(
                                    cleanHtmlContent(item.content).substring(
                                      0,
                                      300
                                    ) +
                                      (item.content.length > 300 ? "..." : ""),
                                    query
                                  )}
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">
                                {new Date(item.lastModified).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                              <span className="text-muted-foreground/30">
                                •
                              </span>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.source === "microsoft"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-destructive/10 text-destructive"
                                }`}
                              >
                                {item.source.charAt(0).toUpperCase() +
                                  item.source.slice(1)}
                              </span>
                              {item.type && (
                                <>
                                  <span className="text-muted-foreground/30">
                                    •
                                  </span>
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    {React.createElement(
                                      sourceIcons[
                                        item.type as keyof typeof sourceIcons
                                      ],
                                      { className: "h-4 w-4" }
                                    )}
                                    <span className="text-xs">
                                      {item.type.charAt(0).toUpperCase() +
                                        item.type.slice(1)}
                                    </span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-8 flex justify-center w-full">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Searching...</span>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        <Dialog
          open={!!selectedItem}
          onOpenChange={(open: boolean) => !open && setSelectedItem(null)}
        >
          <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {selectedItem?.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedItem?.lastModified &&
                        new Date(selectedItem.lastModified).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                    </span>
                    <span className="text-muted-foreground/30">•</span>
                    {selectedItem?.source && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedItem.source === "microsoft"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {selectedItem.source.charAt(0).toUpperCase() +
                          selectedItem.source.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
                {selectedItem?.url && (
                  <a
                    href={selectedItem.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    Open
                    <ExternalLink className="ml-2 -mr-1 w-4 h-4" />
                  </a>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 mt-6 overflow-auto">
              <div className="bg-muted rounded-lg p-6">
                {selectedItem?.title?.endsWith(".pdf") ? (
                  <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg border border-border">
                    <div className="w-16 h-16 text-primary">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-foreground mb-1">
                        {selectedItem.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This document needs to be opened in SharePoint to view
                        its contents
                      </p>
                      <a
                        href={selectedItem.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Open in SharePoint
                        <ExternalLink className="ml-2 -mr-1 w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {selectedItem?.type === "email" ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email Message</span>
                        </div>
                        <div className="bg-background rounded-lg p-6 shadow-sm">
                          {cleanHtmlContent(selectedItem?.content || "")
                            .split("\n")
                            .map((line, i) => (
                              <p
                                key={i}
                                className="mb-4 text-foreground leading-relaxed"
                              >
                                {line}
                              </p>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-foreground leading-relaxed">
                        {cleanHtmlContent(selectedItem?.content || "")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
