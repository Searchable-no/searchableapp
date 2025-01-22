"use client";

import { useState } from "react";
import SearchResults from "@/components/search-results";
import { Search, Filter } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({
    totalCount: 0,
    categories: [],
    query: "",
    dateRange: "all",
  });

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="pt-16 pb-12 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Search Across Your Services
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find anything from your emails, documents, and more in one place
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-2xl shadow-xl p-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search emails, documents, and more..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-0 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-50 rounded-xl">
                  <Filter className="h-5 w-5 text-gray-400 ml-3" />
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="py-4 pl-2 pr-8 rounded-xl border-0 bg-transparent text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Sources</option>
                    <option value="microsoft">Microsoft</option>
                    <option value="google">Google</option>
                  </select>
                </div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="py-4 px-4 rounded-xl border-0 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="recent">Last 7 Days</option>
                  <option value="last-week">Last 14 Days</option>
                  <option value="last-month">Last 30 Days</option>
                </select>
                <button
                  onClick={handleSearch}
                  disabled={!query.trim() || isLoading}
                  className="py-4 px-8 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="max-w-4xl mx-auto pb-16">
          <SearchResults results={results} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
