import { NextRequest, NextResponse } from "next/server";
import { searchSharePointFiles, type SearchResult } from "@/lib/microsoft-graph";
import { searchEmails } from "@/lib/email-search";
import { searchTeamsMessages } from "@/lib/teams-search";
import { suggestSpellingCorrection } from "@/lib/string-similarity";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const userId = searchParams.get("userId");
    const siteId = searchParams.get("siteId");
    const contentTypesParam = searchParams.get("contentTypes");
    
    console.log("Search API called with params:", { 
      query, 
      userId: userId ? "provided" : "missing", 
      siteId: siteId || "all",
      contentTypes: contentTypesParam || "none" 
    });
    
    // File extensions and content types handling
    let contentTypes: string[] = [];
    let fileExtensions: string[] = [];
    
    if (contentTypesParam) {
      const types = contentTypesParam.split(",");
      
      // Separate content types from file extensions
      contentTypes = types.filter(type => 
        ['file', 'folder', 'email', 'teams'].includes(type)
      );
      
      // The rest are file extensions like docx, pdf, etc.
      fileExtensions = types.filter(type => 
        !['file', 'folder', 'email', 'teams', 'planner'].includes(type)
      );
      
      console.log("Parsed search parameters:", {
        query,
        contentTypes,
        fileExtensions,
        siteId: siteId || 'all',
        hasQuery: !!query.trim()
      });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID parameter" },
        { status: 400 }
      );
    }

    let results: SearchResult[] = [];
    let suggestedQuery: string | null = null;

    // Always include folders in the results when a site is selected
    if (siteId) {
      console.log("Site specific search, including folders in results");
      // When a specific site is selected, search for files and folders
      // Always include folders when a site is selected to enable folder filtering
      const allowedContentTypes = ['file', 'folder'] as const;
      type AllowedContentType = typeof allowedContentTypes[number];
      
      const contentTypesToSearch: AllowedContentType[] = contentTypes.includes('file') || contentTypes.includes('folder') ? 
        (contentTypes.filter(type => allowedContentTypes.includes(type as AllowedContentType)) as AllowedContentType[]) : 
        ['file', 'folder'];
        
      // Make sure 'folder' is always included when a site is selected
      if (!contentTypesToSearch.includes('folder')) {
        contentTypesToSearch.push('folder');
      }
      
      console.log("Content types for site search:", contentTypesToSearch);
      
      results = await searchSharePointFiles(
        userId, 
        query, 
        siteId,
        contentTypesToSearch,
        fileExtensions
      );
      
      console.log(`Found ${results.length} results, including folders: ${results.filter(r => r.type === 'folder').length}`);
    } else {
      // When no site is selected, search based on content types
      const searchPromises: Promise<SearchResult[]>[] = [];

      // If no content types specified or if 'file' or 'folder' is included
      if (contentTypes.length === 0 || contentTypes.some(type => ['file', 'folder'].includes(type))) {
        searchPromises.push(
          searchSharePointFiles(
            userId, 
            query, 
            undefined, 
            contentTypes.length > 0 ? 
              contentTypes.filter(type => ['file', 'folder'].includes(type)) as ('file' | 'folder')[] : 
              undefined,
            fileExtensions
          )
        );
      }

      // If no content types specified or if 'email' is included
      if (contentTypes.length === 0 || contentTypes.includes('email')) {
        searchPromises.push(searchEmails(userId, query));
      }

      // If no content types specified or if 'teams' is included
      if (contentTypes.length === 0 || contentTypes.includes('teams')) {
        searchPromises.push(searchTeamsMessages(userId, query));
      }

      // Planner tasks are no longer included regardless of content type

      // Wait for all search promises to complete
      const searchResults = await Promise.all(searchPromises);

      // Combine and sort all results by score
      results = searchResults
        .flat()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    
    // Additional filter to ensure no planner tasks are included
    results = results.filter(result => result.type !== 'planner');
    
    // Check for path information in results
    const withPath = results.filter(r => 'path' in r).length;
    const withWebUrl = results.filter(r => r.webUrl).length;
    console.log(`Path information: ${withPath}/${results.length} results have path, ${withWebUrl}/${results.length} have webUrl`);
    
    // Add raw object paths for debugging
    if (siteId) {
      console.log('First few search results:', results.slice(0, 3).map(r => ({
        name: r.name,
        type: r.type,
        webUrl: r.webUrl,
        hasPath: 'path' in r
      })));
    }
    
    // Only check for spelling correction if there's an actual query
    if (query.trim()) {
      suggestedQuery = suggestSpellingCorrection(query);
    }
    
    return NextResponse.json({ 
      results,
      suggestedQuery 
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
} 