"use client";

import { useState, useEffect, useCallback } from "react";
import SearchResults from "@/components/search-results";
import { Search, Filter, Loader2, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import debounce from "lodash/debounce";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [results, setResults] = useState({
    totalCount: 0,
    categories: [],
    query: "",
    dateRange: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setShowFilters(window.innerWidth >= 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchSuggestions = useCallback(
    debounce(async (input: string) => {
      if (!input.trim()) {
        setSuggestions([]);
        return;
      }

      setIsSuggestionsLoading(true);
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
      } finally {
        setIsSuggestionsLoading(false);
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
      case "Enter":
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(suggestions[selectedSuggestionIndex]);
        } else {
          handleSearch();
        }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pt-32 pb-24 text-center"
        >
          <h1 className="text-6xl sm:text-7xl font-extrabold mb-8 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Unified Search
            </span>
          </h1>
          <p className="text-2xl sm:text-3xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Discover insights across all your services in one powerful search
          </p>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="max-w-4xl mx-auto mb-20 shadow-2xl hover:shadow-3xl transition-shadow duration-300 bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col gap-6">
                <div className="relative flex-1">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="What are you looking for?"
                      value={query}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="w-full pl-12 pr-12 py-7 text-xl transition-all duration-200 border-2 focus:border-blue-500 rounded-2xl shadow-inner"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (query.trim()) {
                          setShowSuggestions(true);
                        }
                      }}
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
                    {isSuggestionsLoading && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <AnimatePresence>
                    {showSuggestions &&
                      suggestions &&
                      suggestions.length > 0 && (
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
                              transition={{
                                duration: 0.15,
                                delay: index * 0.05,
                              }}
                              className={`px-6 py-4 cursor-pointer transition-colors duration-150
                            ${
                              index === selectedSuggestionIndex
                                ? "bg-blue-50"
                                : "hover:bg-gray-50"
                            }
                            ${
                              index !== suggestions.length - 1
                                ? "border-b border-gray-100"
                                : ""
                            }`}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleSuggestionClick(suggestion);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-700 text-lg">
                                  {highlightMatch(suggestion, query)}
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col sm:flex-row gap-4 flex-grow"
                      >
                        <Select value={source} onValueChange={setSource}>
                          <SelectTrigger className="w-full sm:w-[200px] rounded-xl py-6">
                            <Filter className="h-5 w-5 mr-2" />
                            <SelectValue placeholder="All Sources" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="microsoft">Microsoft</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={dateRange} onValueChange={setDateRange}>
                          <SelectTrigger className="w-full sm:w-[200px] rounded-xl py-6">
                            <Calendar className="h-5 w-5 mr-2" />
                            <SelectValue placeholder="All Time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="recent">Last 7 Days</SelectItem>
                            <SelectItem value="last-week">
                              Last 14 Days
                            </SelectItem>
                            <SelectItem value="last-month">
                              Last 30 Days
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex gap-4 sm:ml-auto">
                    <Button
                      onClick={() => setShowFilters(!showFilters)}
                      variant="outline"
                      className="sm:hidden rounded-xl py-6 px-8"
                    >
                      <Filter className="h-5 w-5 mr-2" />
                      Filters
                    </Button>
                    <Button
                      onClick={handleSearch}
                      disabled={!query.trim() || isLoading}
                      className="w-full sm:w-auto py-6 px-10 text-lg font-semibold rounded-xl transition-all duration-300 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Searching...</span>
                        </div>
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-4xl mx-auto pb-32"
        >
          <SearchResults results={results} isLoading={isLoading} />
        </motion.div>
      </div>
    </div>
  );
}
