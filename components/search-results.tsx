import { FC } from "react";
import { Mail, FileText, Calendar, Link, Search, Clock } from "lucide-react";
import { format } from "date-fns";

interface SearchResult {
  id: string;
  title: string;
  content?: string;
  url?: string;
  lastModified: string;
  type: "email" | "document";
  source: "google" | "microsoft";
}

interface SearchCategory {
  category: string;
  source: string;
  type: string;
  count: number;
  items: SearchResult[];
}

interface SearchResultsProps {
  results: {
    totalCount: number;
    categories: SearchCategory[];
    query: string;
    dateRange: string;
  };
  isLoading?: boolean;
}

const ResultIcon: FC<{ type: string; className?: string }> = ({
  type,
  className = "w-5 h-5",
}) => {
  if (type === "email") return <Mail className={className} />;
  if (type === "document") return <FileText className={className} />;
  return <Calendar className={className} />;
};

const SourceBadge: FC<{ source: string }> = ({ source }) => {
  const bgColor = source === "microsoft" ? "bg-blue-50" : "bg-red-50";
  const textColor = source === "microsoft" ? "text-blue-700" : "text-red-700";
  const borderColor =
    source === "microsoft" ? "border-blue-100" : "border-red-100";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} ${borderColor} border`}
    >
      {source === "microsoft" ? "Microsoft 365" : "Google Workspace"}
    </span>
  );
};

const cleanHtmlContent = (html: string): string => {
  // Remove HTML tags
  const withoutTags = html.replace(/<[^>]*>/g, " ");

  // Replace multiple spaces/newlines with single space
  const cleaned = withoutTags
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

  // Decode HTML entities
  const decoded = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded;
};

const ContentPreview: FC<{ content?: string; type: string }> = ({
  content,
  type,
}) => {
  if (!content) return null;

  const displayContent = type === "email" ? cleanHtmlContent(content) : content;

  return (
    <div className="mt-3">
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-100 to-blue-50 rounded-l" />
        <div className="pl-4 pr-2">
          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
            {displayContent}
          </p>
        </div>
      </div>
    </div>
  );
};

const SearchResults: FC<SearchResultsProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="space-y-4">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-5 h-5 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-5/6" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!results.query) {
    return (
      <div className="text-center py-16">
        <div className="bg-blue-50/50 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Start searching
        </h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Enter a search term to find content across your connected services
        </p>
      </div>
    );
  }

  if (results.totalCount === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-gray-50 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No results found
        </h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Try adjusting your search or filters to find what you're looking for
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {results.totalCount} results
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
            "{results.query}"
          </span>
        </div>
        {results.dateRange !== "all" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>
              {results.dateRange
                .replace("-", " ")
                .replace(/^\w/, (c) => c.toUpperCase())}
            </span>
          </div>
        )}
      </div>

      {results.categories.map((category) => (
        <div key={category.category} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ResultIcon type={category.type} className="text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700">
                {category.type === "email" ? "Emails" : "Documents"}
              </h3>
            </div>
            <SourceBadge source={category.source} />
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-500">
              {category.count} results
            </span>
          </div>

          <div className="grid gap-3">
            {category.items.map((item) => (
              <div
                key={item.id}
                className="group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <ResultIcon
                        type={item.type}
                        className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-gray-900 hover:text-blue-600 truncate group-hover:underline decoration-blue-300 decoration-2 underline-offset-2"
                      >
                        {item.title}
                      </a>
                      <Link className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        {format(
                          new Date(item.lastModified),
                          "MMM d, yyyy, h:mm a"
                        )}
                      </p>
                    </div>
                    <ContentPreview content={item.content} type={item.type} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;
