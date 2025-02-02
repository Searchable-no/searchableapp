"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Mail, FileText } from "lucide-react";
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // Show error state if session loading failed
  if (sessionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error loading session
          </h2>
          <p className="text-gray-600">{sessionError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Hero Section - Only show when no results */}
        {!results.totalCount && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-20"
          >
            <h1 className="text-6xl sm:text-7xl font-extrabold mb-8 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
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
                className="w-full pl-12 pr-12 py-3 text-lg rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              {query && (
                <button
                  onClick={handleClearInput}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  className="absolute left-0 right-0 mt-2 py-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto z-50"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                        index === selectedSuggestionIndex
                          ? "bg-gray-50"
                          : "bg-white"
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
            <div className="text-sm text-gray-500 mb-4">
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
                        sourceColors[
                          category.source as keyof typeof sourceColors
                        ].icon
                      }`}
                    >
                      {sourceIcons[
                        category.type as keyof typeof sourceIcons
                      ] && (
                        <div className="h-4 w-4 text-white">
                          {React.createElement(
                            sourceIcons[
                              category.type as keyof typeof sourceIcons
                            ]
                          )}
                        </div>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold">
                      {category.category} ({category.count})
                    </h2>
                  </div>

                  <div className="grid gap-4 w-full">
                    {category.items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 w-full"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium mb-1">
                              {highlightMatch(item.title, query)}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {highlightMatch(
                                item.content.substring(0, 200) + "...",
                                query
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>
                                {new Date(
                                  item.lastModified
                                ).toLocaleDateString()}
                              </span>
                              <span>•</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs ${
                                  sourceColors[item.source].badge
                                }`}
                              >
                                {item.source}
                              </span>
                            </div>
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Open
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
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-600">Searching...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
