import { NextRequest, NextResponse } from "next/server";
import { searchSharePointFiles, type SearchResult } from "@/lib/microsoft-graph";
import { searchEmails } from "@/lib/email-search";
import { searchTeamsMessages } from "@/lib/teams-search";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const userId = searchParams.get("userId");
    const siteId = searchParams.get("siteId");
    const contentTypes = searchParams.get("contentTypes")?.split(",") as ('file' | 'folder' | 'email' | 'teams' | 'planner')[] | undefined;

    if (!query || !userId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    let results: SearchResult[] = [];

    if (siteId) {
      // When a specific site is selected, only search for files
      results = await searchSharePointFiles(
        userId, 
        query, 
        siteId,
        ['file', 'folder']
      );
    } else {
      // When no site is selected, search based on content types
      const searchPromises: Promise<SearchResult[]>[] = [];

      // If no content types specified or if 'file' or 'folder' is included
      if (!contentTypes || contentTypes.some(type => ['file', 'folder'].includes(type))) {
        searchPromises.push(searchSharePointFiles(userId, query));
      }

      // If no content types specified or if 'email' is included
      if (!contentTypes || contentTypes.includes('email')) {
        searchPromises.push(searchEmails(userId, query));
      }

      // If no content types specified or if 'teams' is included
      if (!contentTypes || contentTypes.includes('teams')) {
        searchPromises.push(searchTeamsMessages(userId, query));
      }

      // Wait for all search promises to complete
      const searchResults = await Promise.all(searchPromises);

      // Combine and sort all results by score
      results = searchResults
        .flat()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
} 