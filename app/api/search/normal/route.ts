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
    
    // File extensions and content types handling
    let contentTypes: string[] = [];
    let fileExtensions: string[] = [];
    
    if (contentTypesParam) {
      const types = contentTypesParam.split(",");
      
      // Separate content types from file extensions
      contentTypes = types.filter(type => 
        ['file', 'folder', 'email', 'teams', 'planner'].includes(type)
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

    // For debugging, log if we're looking for .docx files specifically
    if (fileExtensions.includes('docx')) {
      console.log("🔍 Searching specifically for DOCX files with query:", query);
    }

    // Only check for spelling correction if there's an actual query
    if (query.trim()) {
      suggestedQuery = suggestSpellingCorrection(query);
    }

    if (siteId) {
      // When a specific site is selected, only search for files
      results = await searchSharePointFiles(
        userId, 
        query, 
        siteId,
        contentTypes.includes('file') || contentTypes.includes('folder') ? 
          contentTypes as ('file' | 'folder')[] : 
          ['file', 'folder'],
        fileExtensions
      );
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

      // Wait for all search promises to complete
      const searchResults = await Promise.all(searchPromises);

      // Combine and sort all results by score
      results = searchResults
        .flat()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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