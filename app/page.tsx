"use client";

import { useState } from "react";
import SearchResults from "@/components/search-results";

export default function Home() {
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
    <main className="flex min-h-screen flex-col items-center p-8 max-w-6xl mx-auto">
      <div className="w-full space-y-8">
        <h1 className="text-4xl font-bold text-center">
          Search Across Your Services
        </h1>

        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search emails, documents, and more..."
            className="flex-1 p-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="p-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="microsoft">Microsoft</option>
            <option value="google">Google</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="p-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="recent">Last 7 Days</option>
            <option value="last-week">Last 14 Days</option>
            <option value="last-month">Last 30 Days</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="p-4 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="mt-8">
          <SearchResults results={results} isLoading={isLoading} />
        </div>
      </div>
    </main>
  );
}
