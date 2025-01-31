"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Mail, FileText, Calendar } from "lucide-react";
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

interface SearchResult {
  id: string;
  title: string;
  content: string;
  url: string | null;
  lastModified: string;
  type: "email" | "document";
  source: "microsoft" | "google";
  similarity?: number;
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

// Source color mapping
const sourceColors = {
  microsoft: {
    badge: "bg-blue-100 text-blue-800 border border-blue-200",
    icon: "bg-blue-600 text-white",
  },
  google: {
    badge: "bg-red-100 text-red-800 border border-red-200",
    icon: "bg-red-600 text-white",
  },
};

// Helper function to decode URL-encoded content
const decodeContent = (content: string) => {
  try {
    return decodeURIComponent(content)
      .replace(/%20/g, " ")
      .replace(/%2F/g, "/")
      .replace(/%3A/g, ":")
      .replace(/%2E/g, ".")
      .replace(/%2D/g, "-")
      .replace(/%5F/g, "_")
      .replace(/%25/g, "%");
  } catch {
    // If decoding fails, return original content
    return content;
  }
};

// Helper function to get a clean filename
const getCleanFilename = (url: string) => {
  try {
    const filename = new URL(url).pathname.split("/").pop() || "";
    return decodeContent(filename);
  } catch {
    // If URL parsing fails, return the last part of the path
    return url.split("/").pop() || url;
  }
};

const cleanHtmlContent = (html: string): string => {
  try {
    // First, try to extract content from HTML body if present
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : html;

    // Remove all HTML tags
    let cleaned = content.replace(/<[^>]+>/g, " ");

    // Remove multiple spaces, newlines, and special characters
    cleaned = cleaned
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&#[0-9]+;/g, "")
      .replace(/&[a-z]+;/g, "")
      .replace(/\u200B/g, "") // Remove zero-width spaces
      .replace(/\u00A0/g, " ") // Replace non-breaking spaces with regular spaces
      .trim();

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return cleaned;
  } catch (error) {
    console.error("Error cleaning HTML content:", error);
    return html; // Return original content if cleaning fails
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
      if (!input.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        const url = `${
          window.location.origin
        }/api/search/autocomplete?q=${encodeURIComponent(input)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    }, 300),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("Input changed to:", value);
    setQuery(value);
    if (value.trim()) {
      setShowSuggestions(true);
      fetchSuggestions(value);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    handleSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (
        showSuggestions &&
        suggestions.length > 0 &&
        selectedSuggestionIndex >= 0
      ) {
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      } else if (query.trim()) {
        handleSearch();
      }
      return;
    }

    if (!showSuggestions || !suggestions.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
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

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${window.location.origin}/api/search?q=${encodeURIComponent(
          query
        )}&source=${source}&date=${dateRange}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults({
        ...data,
        query,
        dateRange,
      });
    } catch (error) {
      console.error("Search error:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  const renderSourceBadge = (source: string, type: string) => {
    const Icon = sourceIcons[type as keyof typeof sourceIcons];
    const colorClasses = sourceColors[source as keyof typeof sourceColors];

    return (
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}
        >
          <span className={`p-1 rounded-full ${colorClasses.icon}`}>
            {Icon && <Icon className="h-3 w-3" />}
          </span>
          {source === "microsoft" && type === "email"
            ? "Outlook"
            : source === "microsoft" && type === "document"
            ? "SharePoint"
            : source === "google" && type === "email"
            ? "Gmail"
            : "Google Drive"}
        </span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "I går";
    } else if (diffDays <= 7) {
      return `${diffDays} dager siden`;
    } else {
      return date.toLocaleDateString("no-NB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  const highlightContentMatches = (content: string, searchQuery: string) => {
    if (!searchQuery) return content;

    // Split search query into words
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    // Create a regex pattern that matches any of the search terms
    const pattern = new RegExp(`(${searchTerms.join("|")})`, "gi");

    // Split content at matches
    const parts = content.split(pattern);

    return (
      <>
        {parts.map((part, i) => {
          // Check if this part matches any search term
          const isMatch = searchTerms.some(
            (term) => part.toLowerCase() === term.toLowerCase()
          );

          return isMatch ? (
            <span key={i} className="bg-yellow-100 text-yellow-900 font-medium">
              {part}
            </span>
          ) : (
            part
          );
        })}
      </>
    );
  };

  const getContentPreview = (content: string, query: string, type: string) => {
    // Decode and clean the content first
    const decodedContent =
      type === "email" ? cleanHtmlContent(content) : decodeContent(content);

    // Split search query into words
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    // Find the first matching term position
    let bestMatchIndex = -1;
    let bestMatchTerm = "";

    searchTerms.forEach((term) => {
      const index = decodedContent.toLowerCase().indexOf(term);
      if (index !== -1 && (bestMatchIndex === -1 || index < bestMatchIndex)) {
        bestMatchIndex = index;
        bestMatchTerm = term;
      }
    });

    if (bestMatchIndex === -1) {
      // If no match found, return first 300 characters
      const preview = decodedContent.slice(0, 300);
      return highlightContentMatches(preview, query);
    }

    // Get a window of text around the match
    const contextSize = 200;
    const start = Math.max(0, bestMatchIndex - contextSize);
    const end = Math.min(
      decodedContent.length,
      bestMatchIndex + bestMatchTerm.length + contextSize
    );

    // Add ellipsis if needed
    const prefix = start > 0 ? "... " : "";
    const suffix = end < decodedContent.length ? " ..." : "";

    const preview = prefix + decodedContent.slice(start, end) + suffix;
    return highlightContentMatches(preview, query);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section - Only show when no search results */}
        {!results.totalCount && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pt-32 pb-24 text-center"
          >
            <h1 className="text-6xl sm:text-7xl font-extrabold mb-8 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                Searchable
              </span>
            </h1>
          </motion.div>
        )}

        {/* Search Bar */}
        <div
          className={`${
            results.totalCount
              ? "sticky top-0 bg-gray-50 py-4 z-50 shadow-sm"
              : ""
          }`}
        >
          <div className="max-w-2xl mx-auto relative">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="What are you looking for?"
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className={`w-full pl-12 pr-12 py-3 text-lg transition-all duration-200 border rounded-full shadow-sm hover:shadow-md focus:shadow-lg ${
                    results.totalCount ? "h-12" : "h-14"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (query.trim()) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setSuggestions([]);
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!query.trim() || isLoading}
                className={`px-8 rounded-full text-white font-medium transition-all duration-200 ${
                  results.totalCount ? "h-12" : "h-14"
                } ${
                  !query.trim() || isLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </div>
                ) : (
                  "Search"
                )}
              </button>
            </div>

            {/* Search Suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-10 w-full bg-white mt-2 rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  {suggestions.map((suggestion, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.05 }}
                      className={`px-6 py-3 cursor-pointer hover:bg-gray-50 flex items-center gap-3 ${
                        index === selectedSuggestionIndex ? "bg-gray-50" : ""
                      }`}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <Search className="h-4 w-4 text-gray-400" />
                      {highlightMatch(suggestion, query)}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filters - Only show when there are results */}
        {results.totalCount > 0 && (
          <div className="bg-white border-y">
            <div className="max-w-3xl mx-auto py-3 flex items-center gap-4 text-sm">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Alle kilder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kilder</SelectItem>
                  <SelectItem value="microsoft">SharePoint</SelectItem>
                  <SelectItem value="google">Google Drive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Når som helst" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Når som helst</SelectItem>
                  <SelectItem value="recent">Siste 7 dager</SelectItem>
                  <SelectItem value="last-week">Siste 14 dager</SelectItem>
                  <SelectItem value="last-month">Siste måned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Search Results */}
        {results.totalCount > 0 && (
          <div className="max-w-3xl mx-auto py-6">
            <div className="text-sm text-gray-600 mb-6">
              Fant {results.totalCount} resultater
            </div>
            <div className="space-y-6">
              {results.categories.flatMap((category) =>
                category.items.map((item, itemIndex) => (
                  <div
                    key={`${category.category}-${itemIndex}`}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <a
                      href={item.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-6"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {renderSourceBadge(item.source, item.type)}
                          {item.lastModified && (
                            <span className="flex items-center text-sm text-gray-500 gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(item.lastModified)}
                            </span>
                          )}
                        </div>
                        {item.similarity && (
                          <div className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700">
                            {Math.round(item.similarity * 100)}% relevant
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 mb-3">
                        {decodeContent(item.title)}
                      </h3>
                      {item.content && (
                        <div className="mb-4">
                          <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                            {getContentPreview(item.content, query, item.type)}
                          </div>
                        </div>
                      )}
                      {item.url && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-3 pt-3 border-t">
                          <FileText className="h-4 w-4" />
                          <span className="truncate">
                            {getCleanFilename(item.url)}
                          </span>
                        </div>
                      )}
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
