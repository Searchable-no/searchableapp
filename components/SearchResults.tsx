"use client";

import { Card } from "@/components/ui/card";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileIcon,
  Loader2,
  ChevronDown,
  X,
  Check,
  Share,
  Mail,
  MessageSquareText,
  Hash,
  Users,
  MessageSquare,
  MessageCircle,
  ListTodo,
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  FileCode,
  FileImage,
  Archive,
  Calendar,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { PlannerTask } from "@/lib/microsoft-graph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FolderTree, buildFolderTree } from "@/components/FolderTree";

// Helper function to determine source based on type and path
function getSource(result: SharePointSearchResult): string {
  // If source is explicitly provided, use it
  if (result.source) return result.source;

  // Handle different types
  switch (result.type.toUpperCase()) {
    case "PLANNER":
      return "Microsoft Planner";
    case "FILE":
      // Check path for source hints
      if (result.path) {
        if (result.path.toLowerCase().includes("/onedrive/")) return "OneDrive";
        if (result.path.toLowerCase().includes("/sharepoint/"))
          return "SharePoint";
      }
      return "SharePoint";
    case "EMAIL":
      return "Outlook";
    case "CHAT":
      return "Microsoft Teams Chat";
    case "CHANNEL":
      return "Microsoft Teams Channel";
    case "EVENT":
      return "Calendar";
    default:
      return "Microsoft 365";
  }
}

// Helper function to format the type display
function formatType(result: CombinedSearchResult): string {
  // Type guard to check if result is SharePointSearchResult with name property
  const isSharePointResult = (
    obj: CombinedSearchResult
  ): obj is SharePointSearchResult => {
    return "name" in obj && typeof obj.name === "string";
  };

  // For planner tasks (can be extended for other types later)
  interface TaskResult {
    title: string;
    type: string;
  }

  console.log("Formatting type for result:", {
    type: result.type,
    name: isSharePointResult(result)
      ? result.name
      : (result as TaskResult).title || "",
    extension:
      result.type === "file" && isSharePointResult(result)
        ? result.name.split(".").pop()
        : null,
  });

  const type = result.type.toLowerCase();

  switch (type) {
    case "email":
      return "Email";
    case "chat":
      return "Teams Chat";
    case "channel":
      return "Teams Channel";
    case "planner":
      return "Task";
    case "folder":
      return "Folder";
    case "file":
      // Make sure we're dealing with a SharePoint result that has a name property
      if (isSharePointResult(result)) {
        // Get file extension for display
        const fileName = result.name;
        const lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex === -1) return "Document";

        const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
        switch (extension) {
          case "docx":
          case "doc":
            return "Word Document";
          case "xlsx":
          case "xls":
            return "Excel Spreadsheet";
          case "pptx":
          case "ppt":
            return "PowerPoint";
          case "pdf":
            return "PDF Document";
          case "txt":
            return "Text File";
          case "jpg":
          case "jpeg":
          case "png":
          case "gif":
            return "Image";
          case "zip":
          case "rar":
          case "7z":
            return "Archive";
          default:
            return `File (${extension || "unknown"})`;
        }
      }
      return "Document";
    default:
      // If it's not a special type, return the original type in uppercase
      return type.toUpperCase();
  }
}

export interface SharePointSearchResult {
  id: string;
  name: string;
  type: string;
  size: number;
  score?: number;
  createdBy?: {
    user?: {
      displayName?: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      displayName?: string;
    };
  };
  source?: string;
  path?: string;
  webUrl?: string;
  driveId?: string;
  lastModifiedDateTime: string;
}

// Define a union type for all search results
export type CombinedSearchResult = SharePointSearchResult | PlannerTask;

interface SearchResultsProps {
  results: CombinedSearchResult[];
  isLoading: boolean;
  error: string | null;
  selectedSiteId?: string | null;
}

// This function needs to handle both SharePointSearchResult and PlannerTask types
function getResultIcon(result: CombinedSearchResult) {
  // Handle Planner tasks
  if (result.type === "planner") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg">
        <ListTodo size={20} />
      </div>
    );
  }

  // For all other types, use the existing logic
  const type = result.type.toLowerCase();

  if (type === "email") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-sky-50 text-sky-500 rounded-lg">
        <Mail size={20} />
      </div>
    );
  }

  if (type === "chat" || type === "chatmessage") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-lg">
        <MessageSquare size={20} />
      </div>
    );
  }

  if (type === "channel" || type === "channelmessage") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-violet-50 text-violet-500 rounded-lg">
        <MessageCircle size={20} />
      </div>
    );
  }

  if (type === "event") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-500 rounded-lg">
        <Calendar size={20} />
      </div>
    );
  }

  // File types
  if (type === "folder") {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-500 rounded-lg">
        <Folder size={20} />
      </div>
    );
  }

  // For files, check the extension
  const name = (result as SharePointSearchResult).name.toLowerCase();
  const extension = name.split(".").pop();

  switch (extension) {
    case "docx":
    case "doc":
      return (
        <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-500 rounded-lg">
          <FileText size={20} />
        </div>
      );
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
    case "pptx":
    case "ppt":
      return <Presentation className="h-4 w-4 text-orange-400" />;
    case "pdf":
      return <File className="h-4 w-4 text-red-400" />;
    case "txt":
      return <FileCode className="h-4 w-4 text-slate-400" />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
      return <FileImage className="h-4 w-4 text-violet-400" />;
    case "zip":
    case "rar":
    case "7z":
      return <Archive className="h-4 w-4 text-amber-400" />;
    default:
      return (
        <div className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-500 rounded-lg">
          <File size={20} />
        </div>
      );
  }
}

// Type for Teams entities (chats, channels)
interface TeamsEntity {
  id: string;
  displayName: string;
  name?: string;
  type: "chat" | "channel" | "team";
}

// Type for Microsoft Teams API responses
interface MicrosoftTeam {
  id: string;
  displayName: string;
  description?: string;
}

interface MicrosoftChannel {
  id: string;
  displayName: string;
}

interface MicrosoftChat {
  id: string;
  topic?: string;
}

// Add after the TeamsEntity interface definition
interface TeamChannels {
  teamId: string;
  channels: MicrosoftChannel[];
  isLoading: boolean;
}

export function SearchResults({
  results,
  isLoading,
  error,
  selectedSiteId,
}: SearchResultsProps) {
  const [selectedFile, setSelectedFile] =
    useState<SharePointSearchResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add filter state
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [creatorFilters, setCreatorFilters] = useState<string[]>([]);
  const [modifierFilters, setModifierFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Add search states for each filter dropdown
  const [typeSearch, setTypeSearch] = useState("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [modifierSearch, setModifierSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");

  // State for sharing functionality
  const [teamsSearchTerm, setTeamsSearchTerm] = useState("");
  const [teamsEntities, setTeamsEntities] = useState<TeamsEntity[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [selectedTeamsEntity, setSelectedTeamsEntity] = useState<string | null>(
    null
  );
  const [availableTeams, setAvailableTeams] = useState<TeamsEntity[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamsEntity | null>(null);
  const [teamChannels, setTeamChannels] = useState<TeamChannels | null>(null);
  const [selectedChannel, setSelectedChannel] =
    useState<MicrosoftChannel | null>(null);

  // For success/error messages
  const [sharingSuccess, setSharingSuccess] = useState<string | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);

  // Extract folder paths and build folder tree
  const getFolderPaths = useCallback(
    (results: CombinedSearchResult[]): string[] => {
      if (!selectedSiteId) return [];

      console.log("Extracting folder paths for site:", selectedSiteId);

      const pathsSet = new Set<string>();
      // Holder styr på hvilke resultater som er mapper
      const folderItems = new Set<string>();

      // First identify all items that are likely folders
      results.forEach((result) => {
        const fileResult = result as SharePointSearchResult;

        // Check if result is explicitly marked as a folder
        if (fileResult.type.toLowerCase() === "folder") {
          if (fileResult.webUrl) {
            try {
              // Store the ID so we can exclude it from search results
              folderItems.add(fileResult.id);
            } catch (e) {
              console.error("Error parsing folder URL:", e);
            }
          }
          return;
        }

        // Sjekk om resultatet sannsynligvis er en mappe basert på URL og navn
        if (fileResult.webUrl) {
          try {
            const url = new URL(fileResult.webUrl);
            const urlPath = url.pathname;
            const name = fileResult.name.toLowerCase();

            // Skip kjente filendelser
            const hasFileExtension =
              /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|txt|zip|rar|7z|mov|one|onetoc2)$/i.test(
                name
              );

            // Hvis URL-en ender med mappenavnet (ingen filendelse) og navnet ikke har filendelse
            if (
              !hasFileExtension &&
              !urlPath.includes("Forms/DispForm.aspx") &&
              (urlPath.endsWith("/" + encodeURIComponent(fileResult.name)) ||
                urlPath.endsWith("/" + fileResult.name))
            ) {
              // Dette er sannsynligvis en mappe
              console.log(
                "Identified folder from result:",
                fileResult.name,
                fileResult.webUrl
              );
              folderItems.add(fileResult.id);

              // Sett type til folder for å behandle det riktig senere
              fileResult.type = "folder";
            }
          } catch (e) {
            console.error("Error checking for folder:", e);
          }
        }
      });

      console.log(`Identified ${folderItems.size} items as folders`);

      // Process all results to extract folder paths
      results.forEach((result) => {
        const fileResult = result as SharePointSearchResult;

        // Try to extract folders from the webUrl
        if (fileResult.webUrl) {
          try {
            // For URLs like "https://searchableno.sharepoint.com/Shared Documents/Krussedull/file.pdf"
            // Extract the folder structure after the site
            const url = new URL(fileResult.webUrl);
            let urlPath = decodeURIComponent(url.pathname);

            // Remove any query parameters (like ?ID=11)
            if (urlPath.includes("Forms/DispForm.aspx")) {
              // This is likely a special file reference, skip it
              return;
            }

            // Skip known non-folder paths
            if (
              urlPath.endsWith(".pdf") ||
              urlPath.endsWith(".docx") ||
              urlPath.endsWith(".xlsx") ||
              urlPath.endsWith(".pptx") ||
              urlPath.endsWith(".png") ||
              urlPath.endsWith(".zip") ||
              urlPath.endsWith(".mov") ||
              urlPath.endsWith(".one") ||
              urlPath.endsWith(".onetoc2")
            ) {
              // This is a file, extract parent folders
              urlPath = urlPath.substring(0, urlPath.lastIndexOf("/"));
            }

            // Keep only the path after the site name
            const segments = urlPath.split("/").filter((s) => s.length > 0);

            // Find the index of 'Shared Documents' or 'Documents'
            const startIndex = segments.findIndex(
              (s) =>
                s === "Shared Documents" ||
                s === "Documents" ||
                s === "SiteAssets"
            );

            if (startIndex !== -1) {
              // Build folder paths incrementally
              let currentPath = segments[startIndex];
              pathsSet.add(currentPath); // Add root folder

              for (let i = startIndex + 1; i < segments.length; i++) {
                currentPath += "/" + segments[i];
                pathsSet.add(currentPath);
              }
            }
          } catch (e) {
            console.error("Error extracting path from URL:", e);
          }
        }
      });

      // If no folders were found, add some top-level folders to make the UI work
      if (pathsSet.size === 0) {
        console.log("No folders found from URLs, adding default folders");

        // Add default SharePoint folders
        pathsSet.add("Shared Documents");
        pathsSet.add("Documents");
      }

      // Sort folders alphabetically for easier navigation
      const paths = Array.from(pathsSet).sort();
      console.log("Extracted folder paths:", paths);

      // Store the folder IDs for filtering
      setFolderItemIds(folderItems);

      return paths;
    },
    [selectedSiteId]
  );

  // State to keep track of items that are folders
  const [folderItemIds, setFolderItemIds] = useState<Set<string>>(new Set());

  // Get unique values for each filterable column
  const uniqueTypes = Array.from(
    new Set(results.map((result) => formatType(result)))
  );
  const uniqueCreators = Array.from(
    new Set(
      results.map((result) => result.createdBy?.user?.displayName || "System")
    )
  );
  const uniqueModifiers = Array.from(
    new Set(
      results.map(
        (result) => result.lastModifiedBy?.user?.displayName || "System"
      )
    )
  );
  const uniqueSources = Array.from(
    new Set(
      results.map((result) => getSource(result as SharePointSearchResult))
    )
  );
  const uniqueFolderPaths = useMemo(
    () => (selectedSiteId ? getFolderPaths(results) : []),
    [selectedSiteId, results, getFolderPaths]
  );
  const folderTree = useMemo(
    () => buildFolderTree(uniqueFolderPaths),
    [uniqueFolderPaths]
  );

  // Filter the dropdown options based on search input
  const filteredTypeOptions = uniqueTypes.filter((type) =>
    type.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const filteredCreatorOptions = uniqueCreators.filter((creator) =>
    creator.toLowerCase().includes(creatorSearch.toLowerCase())
  );

  const filteredModifierOptions = uniqueModifiers.filter((modifier) =>
    modifier.toLowerCase().includes(modifierSearch.toLowerCase())
  );

  const filteredSourceOptions = uniqueSources.filter((source) =>
    source.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  // Filter results - exclude folders from results and apply selected filters
  const filteredResults = results.filter((result) => {
    // Skip items identified as folders - they should only appear in the folder tree
    if (folderItemIds.has(result.id)) {
      return false;
    }

    // Apply type filter
    if (typeFilters.length > 0 && !typeFilters.includes(formatType(result))) {
      return false;
    }

    // Apply creator filter
    if (
      creatorFilters.length > 0 &&
      !creatorFilters.includes(result.createdBy?.user?.displayName || "System")
    ) {
      return false;
    }

    // Apply modifier filter
    if (
      modifierFilters.length > 0 &&
      !modifierFilters.includes(
        result.lastModifiedBy?.user?.displayName || "System"
      )
    ) {
      return false;
    }

    // Apply source filter
    if (
      sourceFilters.length > 0 &&
      !sourceFilters.includes(getSource(result as SharePointSearchResult))
    ) {
      return false;
    }

    // Apply folder filter when a site is selected
    if (selectedSiteId && selectedFolder) {
      const fileResult = result as SharePointSearchResult;
      if (!fileResult.webUrl) return false;

      try {
        const url = new URL(fileResult.webUrl);
        const urlPath = decodeURIComponent(url.pathname);

        // Identify possible parent paths to check specific folder hierarchy
        const segments = urlPath.split("/").filter((s) => s.length > 0);

        // Find the starting index for library folders like 'Shared Documents' or 'Documents'
        const startIndex = segments.findIndex(
          (s) =>
            s === "Shared Documents" || s === "Documents" || s === "SiteAssets"
        );

        if (startIndex === -1) return false;

        // Build a normalized path from the URL for comparison with selectedFolder
        let urlFolderPath = "";
        for (let i = startIndex; i < segments.length - 1; i++) {
          if (i === startIndex) {
            urlFolderPath = segments[i];
          } else {
            urlFolderPath += "/" + segments[i];
          }
        }

        // Debug information to help identify issues
        console.log("File path check:", {
          file: fileResult.name,
          urlFolderPath: urlFolderPath,
          selectedFolder: selectedFolder,
          isMatch: urlFolderPath === selectedFolder,
          isSubfolder: urlFolderPath.startsWith(selectedFolder + "/"),
          segments: segments,
        });

        // Check for exact folder match or being in a subfolder of the selected folder
        const isInSelectedFolder =
          urlFolderPath === selectedFolder || // Exact match
          urlFolderPath.startsWith(selectedFolder + "/"); // Item is in a subfolder

        if (!isInSelectedFolder) return false;
      } catch (e) {
        // If URL parsing fails, keep the result
        console.error("Error checking folder match:", e);
      }
    }

    return true;
  });

  // Calculate pagination based on filtered results
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = filteredResults.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    typeFilters,
    creatorFilters,
    modifierFilters,
    sourceFilters,
    selectedFolder,
  ]);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(i);
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pages.push("...");
      }
    }
    return pages;
  };

  const handleFileSelect = async (result: CombinedSearchResult) => {
    // Handle Planner tasks differently - just open the URL
    if (result.type === "planner") {
      if (result.webUrl) {
        window.open(result.webUrl, "_blank");
      }
      return;
    }

    // Cast to SharePointSearchResult for file operations
    const fileResult = result as SharePointSearchResult;
    setSelectedFile(fileResult);

    try {
      // Determine the driveId
      let driveId = fileResult.driveId;

      // If no driveId is provided directly, try to extract it from the file ID
      if (!driveId && fileResult.id) {
        if (fileResult.id.includes("!")) {
          [driveId] = fileResult.id.split("!");
        } else if (fileResult.id.includes(",")) {
          [driveId] = fileResult.id.split(",");
        }
      }

      // If we still don't have a driveId and it's a SharePoint file, use the default Documents library ID
      if (!driveId && fileResult.webUrl?.includes("sharepoint.com")) {
        driveId = "b!6ouVabiacEOJOIH3ZtBNuQxkdvT6fHlLgWYCa3Nzj0o";
      }

      if (!driveId || !fileResult.id) {
        console.error("No driveId or fileId available for file:", fileResult);
        return;
      }

      const response = await fetch(
        `/api/preview?fileId=${encodeURIComponent(
          fileResult.id
        )}&driveId=${encodeURIComponent(driveId)}`
      );

      if (!response.ok) {
        throw new Error(`Preview request failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.previewUrl) {
        throw new Error("No preview URL returned");
      }

      setPreviewUrl(data.previewUrl);
    } catch (error) {
      console.error("Failed to get preview URL:", error);
      // Fallback to webUrl if preview fails
      if (fileResult.webUrl) {
        setPreviewUrl(fileResult.webUrl);
      }
    }
  };

  const handleDialogClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // Load user's Teams when component mounts
  useEffect(() => {
    async function loadUserTeams() {
      console.log(
        "Loading Teams",
        selectedFile ? "with file selected" : "no file selected"
      );

      setIsLoadingTeams(true);
      let successfullyLoadedTeams = false;

      try {
        // Hent brukerens Teams
        console.log("Fetching teams from /api/microsoft/resources/teams");
        const teamsResponse = await fetch("/api/microsoft/resources/teams");

        if (!teamsResponse.ok) {
          console.error(
            `Failed to fetch teams: ${teamsResponse.status} ${teamsResponse.statusText}`
          );
          throw new Error(
            `Failed to fetch teams: ${teamsResponse.status} ${teamsResponse.statusText}`
          );
        }

        const teamsData = await teamsResponse.json();
        console.log("Teams data received:", teamsData);

        if (teamsData && teamsData.teams && Array.isArray(teamsData.teams)) {
          console.log(`Found ${teamsData.teams.length} teams from API`);

          const formattedTeams = teamsData.teams.map((team: MicrosoftTeam) => ({
            id: team.id,
            displayName: team.displayName || "Unnamed Team",
            type: "team" as const,
          }));

          setAvailableTeams(formattedTeams);
          console.log(`Lastet ${formattedTeams.length} teams`);

          // Mark that we successfully loaded teams
          successfullyLoadedTeams = formattedTeams.length > 0;

          // Also load recent chats for quick access
          if (formattedTeams.length > 0) {
            setTeamsEntities(formattedTeams);
          }
        } else {
          console.warn(
            "No teams found in response or invalid response format",
            teamsData
          );
        }
      } catch (error) {
        console.error("Feil ved lasting av Teams:", error);
      }

      // Load chats regardless of whether teams loaded successfully
      try {
        console.log("Fetching recent chats...");
        const chatsResponse = await fetch(`/api/teams/chats`);

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json();

          if (chatsData && chatsData.chats && Array.isArray(chatsData.chats)) {
            console.log(`Found ${chatsData.chats.length} chats`);

            const formattedChats = chatsData.chats.map(
              (chat: MicrosoftChat) => {
                console.log("Processing chat ID:", chat.id);

                // Validate chat ID format - should start with digits and colon
                const isValidChatId = /^\d+:/.test(chat.id);
                if (!isValidChatId) {
                  console.warn(`Invalid chat ID format detected: ${chat.id}`);
                }

                return {
                  id: chat.id,
                  displayName: chat.topic || "Chat",
                  type: "chat" as const,
                };
              }
            );

            // Add recent chats to existing teams or as the only options
            if (formattedChats.length > 0) {
              setTeamsEntities((prevEntities) => [
                ...prevEntities,
                ...formattedChats,
              ]);
              console.log(
                `Added ${formattedChats.length} chats to sharing options`
              );

              // If we didn't load any teams but found chats, we consider this successful
              if (!successfullyLoadedTeams) {
                successfullyLoadedTeams = true;
              }
            }
          }
        } else {
          console.warn(`Failed to fetch chats: ${chatsResponse.status}`);
        }
      } catch (error) {
        console.error("Error fetching chats:", error);
      }

      // Set error message if we couldn't load any sharing options
      if (!successfullyLoadedTeams) {
        setSharingError(
          "Kunne ikke laste team eller chatter. Sjekk tilkoblingen din til Microsoft 365."
        );
      } else {
        setSharingError(null);
      }

      setIsLoadingTeams(false);
    }

    // Load teams when the dialog is opened
    if (selectedFile) {
      loadUserTeams();
    }
  }, [selectedFile]);

  // Function to search Teams chats and channels
  const searchTeamsEntities = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      // Hvis søketermen er tom, vis alle tilgjengelige teams
      setTeamsEntities(availableTeams);
      return;
    }

    setIsLoadingTeams(true);
    setSharingError(null);

    try {
      // Filtrerer tilgjengelige teams basert på søkeordet
      const filteredTeams = availableTeams.filter(
        (team) =>
          team.displayName &&
          team.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Hvis vi har teams som matcher, hent kanalene for disse
      let allResults: TeamsEntity[] = [...filteredTeams];

      // Hent kanaler for hvert team som matcher
      for (const team of filteredTeams) {
        try {
          console.log(`Fetching channels for team ${team.id}`);
          const channelsResponse = await fetch(
            `/api/teams/channels?teamId=${team.id}`
          );

          if (channelsResponse.ok) {
            const channelsData = await channelsResponse.json();
            console.log(
              `Got ${channelsData?.channels?.length || 0} channels for team ${
                team.id
              }`
            );

            if (
              channelsData &&
              channelsData.channels &&
              Array.isArray(channelsData.channels)
            ) {
              const teamChannels = channelsData.channels
                .filter(
                  (channel: MicrosoftChannel) =>
                    channel.displayName &&
                    channel.displayName
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase())
                )
                .map((channel: MicrosoftChannel) => ({
                  id: `${team.id}:${channel.id}`,
                  displayName: `${team.displayName} > ${
                    channel.displayName || "Unnamed Channel"
                  }`,
                  teamId: team.id,
                  channelId: channel.id,
                  type: "channel" as const,
                }));

              allResults = [...allResults, ...teamChannels];
              console.log(`Added ${teamChannels.length} channels to results`);
            }
          } else {
            console.warn(
              `Failed to fetch channels for team ${team.id}: ${channelsResponse.status}`
            );
          }
        } catch (error) {
          console.error(
            `Feil ved henting av kanaler for team ${team.id}:`,
            error
          );
        }
      }

      // Hent også chats som matcher søket
      try {
        console.log(`Searching for chats with query: ${searchTerm}`);
        const chatsResponse = await fetch(
          `/api/teams/chats?query=${encodeURIComponent(searchTerm)}`
        );

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json();
          console.log(`Found ${chatsData?.chats?.length || 0} matching chats`);

          if (chatsData && chatsData.chats && Array.isArray(chatsData.chats)) {
            const formattedChats = chatsData.chats.map(
              (chat: MicrosoftChat) => {
                console.log("Processing chat ID:", chat.id);

                // Validate chat ID format - should start with digits and colon
                const isValidChatId = /^\d+:/.test(chat.id);
                if (!isValidChatId) {
                  console.warn(`Invalid chat ID format detected: ${chat.id}`);
                }

                return {
                  id: chat.id,
                  displayName: chat.topic || "Chat",
                  type: "chat" as const,
                };
              }
            );

            allResults = [...allResults, ...formattedChats];
            console.log(`Added ${formattedChats.length} chats to results`);
          }
        } else {
          console.warn(`Failed to fetch chats: ${chatsResponse.status}`);
        }
      } catch (error) {
        console.error("Feil ved henting av chats:", error);
      }

      setTeamsEntities(allResults);
      console.log(`Total search results: ${allResults.length}`);
    } catch (error) {
      console.error("Error searching Teams entities:", error);
      setSharingError("Failed to search Teams entities");
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Oppdater søkeresultater når søkestrengen endres
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedFile) {
        searchTeamsEntities(teamsSearchTerm);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [teamsSearchTerm, selectedFile, availableTeams]);

  // Function to share file to Teams
  const shareToTeams = async () => {
    if (!selectedFile || !selectedTeamsEntity) {
      setSharingError("Please select a Teams chat or channel");
      return;
    }

    setSharingError(null);
    setIsLoadingTeams(true);

    try {
      const response = await fetch("/api/teams/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl: selectedFile.webUrl,
          fileName: selectedFile.name,
          teamsEntityId: selectedTeamsEntity,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to share to Teams");
      }

      setSharingSuccess("Successfully shared to Teams");
      setTimeout(() => setSharingSuccess(null), 3000);
    } catch (error) {
      console.error("Error sharing to Teams:", error);
      setSharingError("Failed to share to Teams");
    } finally {
      setIsLoadingTeams(false);
    }
  };

  // Function to share file via email
  const shareViaEmail = async () => {
    if (!selectedFile) {
      setSharingError("Please select a file to share");
      return;
    }

    try {
      // Opprett parametre for Outlook Web-lenken
      const subject = encodeURIComponent(`Deling av fil: ${selectedFile.name}`);
      const body = encodeURIComponent(`Hei,

Jeg deler følgende fil med deg: ${selectedFile.name}
Link: ${selectedFile.webUrl}

Vennlig hilsen`);

      // Åpne Outlook Web App i nettleseren direkte med et nytt mail-utkast
      const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
      console.log("Opening Outlook Web URL:", outlookWebUrl);

      // Åpne i ny fane
      window.open(outlookWebUrl, "_blank");

      // Vis bekreftelse til brukeren
      setSharingSuccess("Outlook Web åpnet med nytt e-postutkast");
      setTimeout(() => setSharingSuccess(null), 3000);
    } catch (error) {
      console.error("Error opening Outlook Web:", error);
      setSharingError(
        "Kunne ikke åpne Outlook Web. Prøv å kopiere lenken manuelt."
      );
    }
  };

  // Function to load channels for a selected team
  const loadTeamChannels = async (team: TeamsEntity) => {
    if (team.type !== "team") return;

    setSelectedTeam(team);
    setTeamChannels({
      teamId: team.id,
      channels: [],
      isLoading: true,
    });

    try {
      console.log(`Fetching channels for team ${team.id}`);
      const channelsResponse = await fetch(
        `/api/teams/channels?teamId=${team.id}`
      );

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        console.log(
          `Got ${channelsData?.channels?.length || 0} channels for team ${
            team.id
          }`
        );

        if (
          channelsData &&
          channelsData.channels &&
          Array.isArray(channelsData.channels)
        ) {
          setTeamChannels({
            teamId: team.id,
            channels: channelsData.channels,
            isLoading: false,
          });
        }
      } else {
        console.warn(`Failed to fetch channels: ${channelsResponse.status}`);
        setTeamChannels({
          teamId: team.id,
          channels: [],
          isLoading: false,
        });
      }
    } catch (error) {
      console.error(`Error fetching channels for team ${team.id}:`, error);
      setTeamChannels({
        teamId: team.id,
        channels: [],
        isLoading: false,
      });
    }
  };

  // Function to handle team selection
  const handleTeamSelection = (team: TeamsEntity) => {
    if (team.type === "team") {
      loadTeamChannels(team);
      // Clear previous selection
      setSelectedTeamsEntity(null);
    } else {
      // For chats or other entity types, set immediately
      setSelectedTeamsEntity(team.id);
      setSelectedTeam(null);
      setSelectedChannel(null);
      setTeamChannels(null);
    }
  };

  // Function to handle channel selection
  const handleChannelSelection = (channel: MicrosoftChannel) => {
    // Set the selected channel for UI purposes
    setSelectedChannel(channel);

    if (selectedTeam) {
      // Format the ID as teamId:channelId for proper sharing
      const formattedEntityId = `${selectedTeam.id}:${channel.id}`;
      console.log(`Setting formatted channel ID: ${formattedEntityId}`);
      setSelectedTeamsEntity(formattedEntityId);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <p className="text-red-500">{error}</p>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-muted-foreground">No results found</p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-4 mb-4 max-w-[95vw] mx-auto">
        {/* Mappe-filter (Folder Tree) som vises når en site er valgt */}
        {selectedSiteId && (
          <div className="col-span-1">
            <FolderTree
              folders={folderTree}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Hoveddel med søkeresultater */}
        <div className={selectedSiteId ? "col-span-4" : "col-span-5"}>
          <Card>
            {/* Header with filter dropdowns */}
            <div className="grid grid-cols-7 gap-4 p-4 font-medium text-sm bg-muted">
              <div className="col-span-2">Name</div>

              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 -ml-1 hover:bg-muted-foreground/10 flex items-center"
                    >
                      Type
                      {typeFilters.length > 0 && (
                        <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                          {typeFilters.length}
                        </span>
                      )}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="p-2">
                      <Input
                        placeholder="Søk etter type..."
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    {typeFilters.length > 0 && (
                      <div className="px-2 pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={() => setTypeFilters([])}
                        >
                          <X className="h-3 w-3 mr-1" /> Fjern alle filtre
                        </Button>
                      </div>
                    )}
                    {filteredTypeOptions.length > 0 ? (
                      filteredTypeOptions.map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={typeFilters.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTypeFilters([...typeFilters, type]);
                            } else {
                              setTypeFilters(
                                typeFilters.filter((t) => t !== type)
                              );
                            }
                          }}
                        >
                          {type}
                        </DropdownMenuCheckboxItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Ingen treff
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 -ml-1 hover:bg-muted-foreground/10 flex items-center"
                    >
                      Created By
                      {creatorFilters.length > 0 && (
                        <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                          {creatorFilters.length}
                        </span>
                      )}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="p-2">
                      <Input
                        placeholder="Søk etter personer..."
                        value={creatorSearch}
                        onChange={(e) => setCreatorSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    {creatorFilters.length > 0 && (
                      <div className="px-2 pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={() => setCreatorFilters([])}
                        >
                          <X className="h-3 w-3 mr-1" /> Fjern alle filtre
                        </Button>
                      </div>
                    )}
                    {filteredCreatorOptions.length > 0 ? (
                      filteredCreatorOptions.map((creator) => (
                        <DropdownMenuCheckboxItem
                          key={creator}
                          checked={creatorFilters.includes(creator)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCreatorFilters([...creatorFilters, creator]);
                            } else {
                              setCreatorFilters(
                                creatorFilters.filter((c) => c !== creator)
                              );
                            }
                          }}
                        >
                          {creator}
                        </DropdownMenuCheckboxItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Ingen treff
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 -ml-1 hover:bg-muted-foreground/10 flex items-center"
                    >
                      Modified By
                      {modifierFilters.length > 0 && (
                        <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                          {modifierFilters.length}
                        </span>
                      )}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="p-2">
                      <Input
                        placeholder="Søk etter personer..."
                        value={modifierSearch}
                        onChange={(e) => setModifierSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    {modifierFilters.length > 0 && (
                      <div className="px-2 pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={() => setModifierFilters([])}
                        >
                          <X className="h-3 w-3 mr-1" /> Fjern alle filtre
                        </Button>
                      </div>
                    )}
                    {filteredModifierOptions.length > 0 ? (
                      filteredModifierOptions.map((modifier) => (
                        <DropdownMenuCheckboxItem
                          key={modifier}
                          checked={modifierFilters.includes(modifier)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setModifierFilters([
                                ...modifierFilters,
                                modifier,
                              ]);
                            } else {
                              setModifierFilters(
                                modifierFilters.filter((m) => m !== modifier)
                              );
                            }
                          }}
                        >
                          {modifier}
                        </DropdownMenuCheckboxItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Ingen treff
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 -ml-1 hover:bg-muted-foreground/10 flex items-center"
                    >
                      Source
                      {sourceFilters.length > 0 && (
                        <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                          {sourceFilters.length}
                        </span>
                      )}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="p-2">
                      <Input
                        placeholder="Søk etter kilde..."
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    {sourceFilters.length > 0 && (
                      <div className="px-2 pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={() => setSourceFilters([])}
                        >
                          <X className="h-3 w-3 mr-1" /> Fjern alle filtre
                        </Button>
                      </div>
                    )}
                    {filteredSourceOptions.length > 0 ? (
                      filteredSourceOptions.map((source) => (
                        <DropdownMenuCheckboxItem
                          key={source}
                          checked={sourceFilters.includes(source)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSourceFilters([...sourceFilters, source]);
                            } else {
                              setSourceFilters(
                                sourceFilters.filter((s) => s !== source)
                              );
                            }
                          }}
                        >
                          {source}
                        </DropdownMenuCheckboxItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Ingen treff
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>Relevance</div>
            </div>

            {/* Add a global filter reset if any filters are active */}
            {(typeFilters.length > 0 ||
              creatorFilters.length > 0 ||
              modifierFilters.length > 0 ||
              sourceFilters.length > 0 ||
              selectedFolder !== null) && (
              <div className="p-2 border-b bg-muted/40 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredResults.length} av {results.length} resultater vises
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setTypeFilters([]);
                    setCreatorFilters([]);
                    setModifierFilters([]);
                    setSourceFilters([]);
                    setSelectedFolder(null);
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Fjern alle filtre
                </Button>
              </div>
            )}

            {/* Results */}
            <div className="divide-y">
              {currentResults.map((result) => (
                <div
                  key={result.id}
                  className="grid grid-cols-7 gap-4 p-4 hover:bg-muted/50 cursor-pointer items-center"
                  onClick={() => handleFileSelect(result)}
                >
                  <div className="col-span-2 flex items-center gap-2">
                    {getResultIcon(result)}
                    <span className="truncate">
                      {result.type === "planner" && "title" in result
                        ? result.title
                        : result.name}
                    </span>
                  </div>
                  <div className="truncate">{formatType(result)}</div>
                  <div className="truncate">
                    {result.createdBy?.user?.displayName || "System"}
                  </div>
                  <div className="truncate">
                    {result.lastModifiedBy?.user?.displayName || "System"}
                  </div>
                  <div className="truncate">
                    {getSource(result as SharePointSearchResult)}
                  </div>
                  <div>
                    {result.score !== undefined && (
                      <div className="relative w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-primary rounded-full"
                          style={{
                            width: `${
                              result.score > 180
                                ? 100
                                : result.score > 120
                                ? 85
                                : result.score > 70
                                ? 65
                                : result.score > 30
                                ? 45
                                : 25
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        className={cn(
                          "cursor-pointer",
                          currentPage === 1 && "pointer-events-none opacity-50"
                        )}
                      />
                    </PaginationItem>

                    {getPageNumbers().map((page, index) => (
                      <PaginationItem key={index}>
                        {page === "..." ? (
                          <span className="px-4 py-2">...</span>
                        ) : (
                          <PaginationLink
                            className="cursor-pointer"
                            isActive={currentPage === page}
                            onClick={() => setCurrentPage(Number(page))}
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        className={cn(
                          "cursor-pointer",
                          currentPage === totalPages &&
                            "pointer-events-none opacity-50"
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedFile} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[95vw] w-full h-[98vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 py-3 border-b flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <FileIcon className="h-5 w-5 text-blue-500" />
              <DialogTitle className="text-xl">
                {selectedFile?.name}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Main content area */}
          <div className="flex flex-1 min-h-0 h-full">
            {/* Preview pane */}
            <div className="flex-1 h-full">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="File preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>

            {/* Details sidebar */}
            <div className="w-80 border-l bg-muted/10 p-6 overflow-y-auto h-full">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">File Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium">
                        {selectedFile && formatType(selectedFile)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium">
                        {selectedFile && formatFileSize(selectedFile.size)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Created By</dt>
                      <dd className="font-medium">
                        {selectedFile?.createdBy?.user?.displayName || "System"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Modified By</dt>
                      <dd className="font-medium">
                        {selectedFile?.lastModifiedBy?.user?.displayName ||
                          "System"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Source</dt>
                      <dd className="font-medium">
                        {selectedFile &&
                          getSource(selectedFile as SharePointSearchResult)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Path</dt>
                      <dd className="font-medium break-all">
                        {selectedFile?.path || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold mb-2">Actions</h3>

                  <Button
                    className="w-full"
                    onClick={() => {
                      if (selectedFile?.webUrl) {
                        window.open(selectedFile.webUrl, "_blank");
                      }
                    }}
                  >
                    Open in Browser
                  </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      if (selectedFile?.webUrl) {
                        // Dette kan åpne filen i klientprogrammet via Office-protokoller
                        // F.eks. ms-word:ofv|u|https://...
                        const url = selectedFile.webUrl;
                        let protocol = "ms-office:ofe|u|";

                        // Bestem protokoll basert på filtype
                        if (
                          selectedFile.name.endsWith(".docx") ||
                          selectedFile.name.endsWith(".doc")
                        ) {
                          protocol = "ms-word:ofe|u|";
                        } else if (
                          selectedFile.name.endsWith(".xlsx") ||
                          selectedFile.name.endsWith(".xls")
                        ) {
                          protocol = "ms-excel:ofe|u|";
                        } else if (
                          selectedFile.name.endsWith(".pptx") ||
                          selectedFile.name.endsWith(".ppt")
                        ) {
                          protocol = "ms-powerpoint:ofe|u|";
                        }

                        window.location.href = protocol + url;
                      }
                    }}
                  >
                    Open in Client Application
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold mb-2">Share</h3>

                  {sharingSuccess && (
                    <div className="bg-green-100 text-green-700 p-2 rounded text-sm mb-2 flex items-center">
                      <Check className="h-4 w-4 mr-1" /> {sharingSuccess}
                    </div>
                  )}

                  {sharingError && (
                    <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-2">
                      {sharingError}
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full" variant="secondary">
                        <MessageSquareText className="h-4 w-4 mr-2" /> Share to
                        Teams
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72">
                      <div className="p-2">
                        <Input
                          placeholder="Søk etter chat eller kanal..."
                          className="h-8 mb-2"
                          value={teamsSearchTerm}
                          onChange={(e) => setTeamsSearchTerm(e.target.value)}
                        />

                        {/* Show channels if a team is selected */}
                        {selectedTeam && teamChannels && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium">
                                {selectedTeam.displayName}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setSelectedTeam(null);
                                  setTeamChannels(null);
                                  setSelectedChannel(null);
                                }}
                              >
                                Back
                              </Button>
                            </div>

                            {teamChannels.isLoading ? (
                              <div className="py-2 flex justify-center">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : teamChannels.channels.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {teamChannels.channels.map((channel) => (
                                  <div
                                    key={channel.id}
                                    className={`flex items-center px-2 py-1.5 rounded text-sm cursor-pointer ${
                                      selectedTeamsEntity ===
                                      `${selectedTeam.id}:${channel.id}`
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-muted"
                                    }`}
                                    onClick={() =>
                                      handleChannelSelection(channel)
                                    }
                                  >
                                    <Hash className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                    <span className="truncate">
                                      {channel.displayName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-2 text-center text-sm text-muted-foreground">
                                No channels found for this team.
                              </div>
                            )}
                          </div>
                        )}

                        {/* If no team is selected, show team/chat list */}
                        {!selectedTeam && (
                          <>
                            <div className="text-xs text-muted-foreground mb-2">
                              {isLoadingTeams ? (
                                <div className="flex items-center">
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />{" "}
                                  Søker...
                                </div>
                              ) : teamsEntities.length > 0 ? (
                                "Velg team, chat eller kanal"
                              ) : (
                                "Sist brukt"
                              )}
                            </div>

                            {isLoadingTeams ? (
                              <div className="py-2 text-center text-sm">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              </div>
                            ) : teamsEntities.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {teamsEntities.map((entity) => (
                                  <div
                                    key={entity.id}
                                    className={`flex items-center px-2 py-1.5 rounded text-sm cursor-pointer ${
                                      selectedTeamsEntity === entity.id
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-muted"
                                    }`}
                                    onClick={() => handleTeamSelection(entity)}
                                  >
                                    {entity.type === "team" ? (
                                      <Users className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                    ) : entity.type === "chat" ? (
                                      <MessageSquare className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                    ) : (
                                      <Hash className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {entity.displayName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : teamsSearchTerm ? (
                              <div className="py-2 text-center text-sm text-muted-foreground">
                                Ingen teams eller kanaler funnet med søkeordet.
                              </div>
                            ) : availableTeams.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {availableTeams.map((team) => (
                                  <div
                                    key={team.id}
                                    className={`flex items-center px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted`}
                                    onClick={() => handleTeamSelection(team)}
                                  >
                                    <Users className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                    <span className="truncate">
                                      {team.displayName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-2 text-center text-sm text-muted-foreground">
                                Ingen teams funnet.
                              </div>
                            )}
                          </>
                        )}

                        <div className="mt-3 text-center">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={shareToTeams}
                            disabled={!selectedTeamsEntity || isLoadingTeams}
                          >
                            {isLoadingTeams ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />{" "}
                                Deler...
                              </>
                            ) : (
                              <>
                                <Share className="h-3 w-3 mr-1" /> Del link
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full" variant="secondary">
                        <Mail className="h-4 w-4 mr-2" /> Åpne i Outlook Web
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72">
                      <div className="p-2">
                        <div className="text-sm text-center mb-3">
                          Dette vil åpne et nytt e-postutkast i Outlook Web
                          direkte i nettleseren med en lenke til dokumentet.
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={shareViaEmail}
                          >
                            <Mail className="h-3 w-3 mr-1" /> Åpne Outlook Web
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
