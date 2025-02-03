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
  const bgColor =
    source === "microsoft" ? "bg-primary/10" : "bg-destructive/10";
  const textColor =
    source === "microsoft" ? "text-primary" : "text-destructive";
  const borderColor =
    source === "microsoft" ? "border-primary/20" : "border-destructive/20";
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
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/20 to-primary/10 rounded-l" />
        <div className="pl-4 pr-2">
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
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
            <div className="h-5 bg-muted rounded w-1/3 mb-6" />
            <div className="space-y-4">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="bg-background rounded-xl p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-5 h-5 bg-muted rounded-full" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                      <div className="space-y-2">
                        <div className="h-3 bg-muted rounded" />
                        <div className="h-3 bg-muted rounded w-5/6" />
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
        <div className="bg-primary/10 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Start searching
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Enter a search term to find content across your connected services
        </p>
      </div>
    );
  }

  if (results.totalCount === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No results found
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Try adjusting your search or filters to find what you&apos;re looking
          for
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {results.totalCount} results
          </h2>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
            &ldquo;{results.query}&rdquo;
          </span>
        </div>
        {results.dateRange !== "all" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              <ResultIcon
                type={category.type}
                className="text-muted-foreground"
              />
              <h3 className="text-sm font-medium text-foreground">
                {category.type === "email" ? "Emails" : "Documents"}
              </h3>
            </div>
            <SourceBadge source={category.source} />
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {category.count} results
            </span>
          </div>

          <div className="grid gap-3">
            {category.items.map((item) => (
              <div
                key={item.id}
                className="group bg-background rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <ResultIcon
                        type={item.type}
                        className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-foreground hover:text-primary truncate group-hover:underline decoration-primary/30 decoration-2 underline-offset-2"
                      >
                        {item.title}
                      </a>
                      <Link className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
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
