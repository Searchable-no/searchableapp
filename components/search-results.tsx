import { FC } from "react";
import { Mail, FileText, Calendar, Link } from "lucide-react";
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

const SearchResults: FC<SearchResultsProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const allResults = results.categories.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryType: category.type,
      categorySource: category.source,
    }))
  );

  return (
    <div className="divide-y divide-gray-200">
      {allResults.map((item) => (
        <div key={item.id} className="py-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <ResultIcon type={item.type} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-medium text-gray-900 hover:text-blue-600 truncate group inline-flex items-center gap-1"
                >
                  {item.title}
                  <Link className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Last modified{" "}
                {format(new Date(item.lastModified), "MMM d, yyyy, h:mm a")}
              </p>
              {item.content && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {item.content}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;
