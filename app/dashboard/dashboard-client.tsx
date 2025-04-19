"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EmailTile } from "@/components/EmailTile";
import { TeamsMessageTile } from "@/components/TeamsMessageTile";
import { TeamsChannelTile } from "@/components/TeamsChannelTile";
import { CalendarTile } from "@/components/CalendarTile";
import { RecentFilesTile, convertToSearchResult, handleFilePreview } from "@/components/RecentFilesTile";
import { DashboardPreferences } from "@/components/DashboardPreferences";
import { NotificationBell } from "@/components/NotificationBell";
import { TileType } from "@/lib/database.types";
import { getData } from "./actions";
import { useUser } from "@/lib/hooks";
import { supabase } from "@/lib/supabase-browser";
import { PlannerTile } from "@/components/PlannerTile";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { AlertCircle, Info, RefreshCw, Users, Calendar, Search, FileText, Plus, MoreHorizontal, Clock, Home, GripVertical, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { TeamsMessageDialog } from "@/components/TeamsMessageDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { FileSearchDialog } from "@/components/FileDialog";
import { EmailDialog } from "@/components/EmailDialog";
import { EmailMessage } from "@/lib/microsoft-graph";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Component mapping registry
const tileComponents = {
  email: EmailTile,
  teams_message: TeamsMessageTile,
  teams_channel: TeamsChannelTile,
  calendar: CalendarTile,
  files: RecentFilesTile,
  planner: PlannerTile,
};

// Default settings
const defaultTiles = ["email", "teams_message", "teams_channel", "calendar", "files", "planner"];
const defaultOrder = [0, 1, 2, 3, 4, 5];
const defaultTilePreferences = {
  size: "normal" as const,
  refreshInterval: 300, // 5 minutes
};
const defaultPreferences = {
  enabledTiles: defaultTiles,
  tileOrder: defaultOrder,
  tilePreferences: Object.fromEntries(
    defaultTiles.map((tile) => [tile, defaultTilePreferences])
  ) as Record<TileType, typeof defaultTilePreferences>,
  theme: "system" as const,
};

// Cache configuration 
const DASHBOARD_CACHE_KEY = 'dashboard_cache';
const DEFAULT_CACHE_EXPIRY = 1800; // 30 minutes in seconds

// Helper functions for localStorage to avoid SSR issues
const getFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return null;
  }
};

const setToLocalStorage = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

// Utility function to check if cache is expired
const isCacheExpired = (timestamp: string | undefined | null, maxAge: number) => {
  if (!timestamp) return true;
  
  try {
    const cacheTime = new Date(timestamp).getTime();
    if (isNaN(cacheTime)) return true;
    
    const now = new Date().getTime();
    const ageInSeconds = (now - cacheTime) / 1000;
    return ageInSeconds > maxAge;
  } catch (error) {
    console.error('Error checking cache expiry:', error);
    return true;
  }
};

// Custom hook to detect navigation events that aren't route changes
function useIsNavigatingFromDashboard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [previousPath, setPreviousPath] = useState(pathname);
  const [isNavigatingFromDashboard, setIsNavigatingFromDashboard] = useState(false);

  useEffect(() => {
    // Only set isNavigatingFromDashboard to true when we navigate away from dashboard
    if (previousPath === '/dashboard' && pathname !== '/dashboard') {
      setIsNavigatingFromDashboard(true);
    } else if (pathname === '/dashboard') {
      // Reset when we're back on dashboard
      setIsNavigatingFromDashboard(false);
    }

    setPreviousPath(pathname);
  }, [pathname, searchParams, previousPath]);

  return isNavigatingFromDashboard;
}

// Datakey (string) til TileType mapping
const dataKeyToTileType: Record<string, TileType> = {
  'emails': 'email',
  'teamsMessages': 'teams_message',
  'channelMessages': 'teams_channel',
  'events': 'calendar',
  'files': 'files',
  'plannerTasks': 'planner'
};

// TileType til datakey (string) mapping
const tileTypeToDataKey: Record<TileType, string> = {
  'email': 'emails',
  'teams_message': 'teamsMessages',
  'teams_channel': 'channelMessages',
  'calendar': 'events',
  'files': 'files',
  'planner': 'plannerTasks'
};

export function DashboardClient() {
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFreshData, setIsFreshData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const { setTheme } = useTheme();
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [selectedChannelMessage, setSelectedChannelMessage] = useState<any>(null);
  const [channelPreviewOpen, setChannelPreviewOpen] = useState(false);
  const [selectedTeamsMessage, setSelectedTeamsMessage] = useState<any>(null);
  const [teamsMessagePreviewOpen, setTeamsMessagePreviewOpen] = useState(false);
  const isNavigatingFromDashboard = useIsNavigatingFromDashboard();
  const router = useRouter();
  const [layouts, setLayouts] = useState<{ [key: string]: any }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // State for file details view
  const [selectedDashboardFile, setSelectedDashboardFile] = useState<any>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  
  // State for email detail view
  const [selectedEmailThread, setSelectedEmailThread] = useState<any>(null);
  const [emailDetailOpen, setEmailDetailOpen] = useState(false);
  const [emailThreadLoading, setEmailThreadLoading] = useState(false);
  const [threadEmails, setThreadEmails] = useState<any[]>([]);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  
  // Calculate date values for display
  const today = new Date();
  const day = useMemo(() => today.getDate(), [today]);
  const weekday = useMemo(() => today.toLocaleDateString('no-NO', { weekday: 'long' }), [today]);
  const month = useMemo(() => today.toLocaleDateString('no-NO', { month: 'long' }), [today]);

  // Event handlers
  const handleChannelMessageClick = useCallback((message: any) => {
    // Ensure we have channelIdentity for kanal-meldinger
    console.log("Channel message clicked:", message);
    if (message.teamName && message.channelName) {
      // Dette er en kanal-melding (channel message)
      setSelectedChannelMessage({
        ...message,
        channelIdentity: {
          teamId: message.teamId,
          channelId: message.channelId,
        },
        teamDisplayName: message.teamName,
        channelDisplayName: message.channelName
      });
      setChannelPreviewOpen(true);
    } else {
      toast.error("Kan ikke åpne meldingen - mangler kanal-informasjon");
    }
  }, []);

  const handleTeamsMessageClick = useCallback((message: any) => {
    // For Teams chat messages, it doesn't need channelIdentity
    console.log("Teams chat message clicked:", message);
    setSelectedTeamsMessage({
      ...message,
      channelIdentity: null, // Eksplisitt vise at dette ikke er en kanal-melding
    });
    setTeamsMessagePreviewOpen(true);
  }, []);
  
  // Handler for file selection
  const handleDashboardFileSelect = useCallback(async (file: any) => {
    setSelectedDashboardFile(convertToSearchResult(file));
    
    try {
      const previewUrl = await handleFilePreview(file);
      setFilePreviewUrl(previewUrl || file.webUrl || null);
    } catch (error) {
      console.error("Error previewing file:", error);
    }
  }, []);

  // Function to fetch complete email thread - memoized to avoid recreating between renders
  const fetchEmailThread = useCallback(async (conversationId: string) => {
    if (!conversationId || !user?.id) {
      console.log("Cannot fetch thread: Missing conversationId or user ID");
      setEmailThreadLoading(false);
      return [];
    }
    
    // Prevent duplicate API calls for same conversation
    const cacheKey = `email_thread_${conversationId}`;
    const cachedThread = getFromLocalStorage(cacheKey);
    if (cachedThread && cachedThread.timestamp) {
      // Use cached thread if it's less than 5 minutes old
      if (!isCacheExpired(cachedThread.timestamp, 300)) {
        console.log(`Using cached thread for ${conversationId}`);
        
        // Ensure all emails have body content
        const emailsWithBody = cachedThread.emails.map((email: EmailMessage) => {
          if (!email.body?.content && email.bodyPreview) {
            return {
              ...email,
              body: {
                content: `<div>${email.bodyPreview}</div>`,
                contentType: 'html'
              }
            };
          }
          return email;
        });
        
        return emailsWithBody;
      }
    }
    
    console.log(`Fetching email thread for conversation: ${conversationId}`);
    setEmailThreadLoading(true);
    
    try {
      // Legg til logging av API-kall
      console.log(`API call: /api/emails/thread?conversationId=${conversationId}`);
      
      const response = await fetch(
        `/api/emails/thread?conversationId=${conversationId}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Thread API error response:", response.status, errorData);
        throw new Error(
          errorData.error || `Failed to fetch thread: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Thread API response:", data);
      
      if (data.emails && Array.isArray(data.emails) && data.emails.length > 0) {
        // Legg til logging av e-post-innhold
        console.log(`Thread has ${data.emails.length} emails. First email body:`, 
          data.emails[0].body ? `${data.emails[0].body.content.substring(0, 100)}...` : "No body");
        
        // Ensure all emails have body content
        const emailsWithBody = data.emails.map((email: EmailMessage) => {
          if (!email.body?.content && email.bodyPreview) {
            return {
              ...email,
              body: {
                content: `<div>${email.bodyPreview}</div>`,
                contentType: 'html'
              }
            };
          }
          return email;
        });
        
        // Cache the thread result
        setToLocalStorage(cacheKey, {
          emails: emailsWithBody,
          timestamp: new Date().toISOString()
        });
        
        return emailsWithBody;
      } else {
        console.warn("API returned empty emails array or invalid format");
      }
      
      // Fallback to initial email with synthetic body if needed
      if (selectedEmailThread?.latestEmail) {
        const fallbackEmail = {
          ...selectedEmailThread.latestEmail,
          body: selectedEmailThread.latestEmail.body || {
            content: `<div>${selectedEmailThread.latestEmail.bodyPreview || "Ingen innhold tilgjengelig"}</div>`,
            contentType: 'html'
          }
        };
        return [fallbackEmail];
      }
      
      return [];
    } catch (error) {
      console.error("Error fetching email thread:", error);
      
      // Fallback to initial email with synthetic body
      if (selectedEmailThread?.latestEmail) {
        const fallbackEmail = {
          ...selectedEmailThread.latestEmail,
          body: selectedEmailThread.latestEmail.body || {
            content: `<div>${selectedEmailThread.latestEmail.bodyPreview || "Ingen innhold tilgjengelig"}</div>`,
            contentType: 'html'
          }
        };
        return [fallbackEmail];
      }
      
      return [];
    } finally {
      setEmailThreadLoading(false);
    }
  }, [user?.id, selectedEmailThread]);

  // Effect to fetch thread when dialog opens - with improved error handling
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout;
    
    // Only attempt to fetch if needed
    if (emailDetailOpen && 
        selectedEmailThread?.latestEmail && 
        !hasAttemptedFetch) {
      
      console.log("Dialog opened, fetching email content", { 
        hasConversationId: !!selectedEmailThread?.latestEmail?.conversationId 
      });
      
      setHasAttemptedFetch(true);
      setEmailThreadLoading(true);
      
      // Set timeout to prevent infinite loading
      loadingTimeout = setTimeout(() => {
        if (isMounted && emailThreadLoading) {
          setEmailThreadLoading(false);
          console.error("Thread loading timed out");
          
          // Use the initial email as fallback with synthetic body
          if (selectedEmailThread?.latestEmail) {
            const fallbackEmail = {
              ...selectedEmailThread.latestEmail,
              body: selectedEmailThread.latestEmail.body || {
                content: `<div>${selectedEmailThread.latestEmail.bodyPreview || "Ingen innhold tilgjengelig"}</div>`,
                contentType: 'html'
              }
            };
            
            setSelectedEmailThread((prev: any) => ({
              ...prev,
              emails: [fallbackEmail]
            }));
          }
        }
      }, 5000);
      
      // Enten bruk conversationId eller fallback til å vise én e-post
      const fetchData = async () => {
        try {
          let emails = [];
          
          if (selectedEmailThread.latestEmail.conversationId) {
            emails = await fetchEmailThread(selectedEmailThread.latestEmail.conversationId);
          } else {
            // For enkelt-e-poster uten conversationId, bruk bare denne e-posten
            const singleEmail = {
              ...selectedEmailThread.latestEmail,
              body: selectedEmailThread.latestEmail.body || {
                content: `<div>${selectedEmailThread.latestEmail.bodyPreview || "Ingen innhold tilgjengelig"}</div>`,
                contentType: 'html'
              }
            };
            emails = [singleEmail];
          }
          
          if (isMounted && emails.length > 0) {
            console.log("Setting email thread with", emails.length, "emails");
            setSelectedEmailThread((prev: any) => ({
              ...prev,
              emails: emails
            }));
          } else {
            console.warn("No emails returned or component unmounted");
          }
        } catch (error) {
          console.error("Error in email fetching effect:", error);
          // Fallback already handled in fetchEmailThread
        } finally {
          if (isMounted) {
            setEmailThreadLoading(false);
          }
          if (loadingTimeout) clearTimeout(loadingTimeout);
        }
      };
      
      fetchData();
    }
    
    // Reset the fetch attempt flag when the dialog is closed
    if (!emailDetailOpen) {
      setHasAttemptedFetch(false);
    }
        
    return () => {
      isMounted = false;
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [emailDetailOpen, selectedEmailThread, fetchEmailThread, hasAttemptedFetch, emailThreadLoading]);

  // Create consistent refresh handler for all tiles
  const createRefreshHandler = useCallback(async (dataKey: string) => {
    try {
      if (refreshing) return;
      console.log(`Refreshing ${dataKey} data`);
      setRefreshing(true);
      
      const tileType = dataKeyToTileType[dataKey];
      if (!tileType) {
        console.error(`Unknown data key: ${dataKey}`);
        setRefreshing(false);
        return;
      }
      
      const result = await getData([tileType], true);
      if (result && result[dataKey as keyof typeof result]) {
        // Update just this tile's data
        setData((prevData: any) => ({
          ...prevData,
          [dataKey]: result[dataKey as keyof typeof result]
        }));
        
        // Mark as fresh
        setIsFreshData(true);
        
        // Update timestamp
        const now = new Date();
        setLastRefreshed(now);
        
        // Update cache
        const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
        if (cachedData) {
          const updatedCache = {
            ...cachedData,
            data: {
              ...cachedData.data,
              [dataKey]: result[dataKey as keyof typeof result]
            },
            timestamp: now.toISOString()
          };
          setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
        }
        
        toast.success(`Data refreshed`);
      }
    } catch (err) {
      console.error(`Error refreshing data:`, err);
      toast.error(`Failed to refresh data`);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // Get data for each tile - memoized to avoid recalculations
  const getTileData = useCallback((tileType: TileType) => {
    // Helper to decide if we should show loading state
    const shouldShowLoading = (dataItems: any[] | undefined) => {
      // If we already have data, don't show loading
      if (dataItems && dataItems.length > 0) return false;
      
      // If we have cached data but no items, show empty instead of loading
      if (!isFreshData) return false;
      
      // Otherwise, show loading if we're actively loading
      return isLoading;
    };

    // Tile-specific data mapping
    switch (tileType) {
      case "email":
        return { 
          emails: data.emails || [], 
          isLoading: shouldShowLoading(data.emails),
          isCachedData: !isFreshData,
          userId: data.userId,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      case "teams_message":
        return {
          messages: data.teamsMessages || [],
          isLoading: shouldShowLoading(data.teamsMessages),
          userId: data.userId,
          isCachedData: !isFreshData,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      case "teams_channel":
        return {
          messages: data.channelMessages || [],
          isLoading: shouldShowLoading(data.channelMessages),
          userId: data.userId,
          isCachedData: !isFreshData,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      case "calendar":
        return { 
          events: data.events || [], 
          isLoading: shouldShowLoading(data.events),
          isCachedData: !isFreshData,
          userId: data.userId,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      case "files":
        return {
          files: data.files || [],
          isLoading: shouldShowLoading(data.files),
          userId: data.userId,
          isCachedData: !isFreshData,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      case "planner":
        return {
          tasks: data.plannerTasks || [],
          isLoading: shouldShowLoading(data.plannerTasks),
          userId: data.userId,
          refreshInterval: preferences.tilePreferences?.planner?.refreshInterval * 1000,
          isCachedData: !isFreshData,
          onRefresh: () => createRefreshHandler(tileTypeToDataKey[tileType])
        };
      default:
        return {};
    }
  }, [data, isLoading, isFreshData, preferences.tilePreferences, createRefreshHandler]);

  // Memoized tile renderer functions to avoid recreating components
  const renderTile = useCallback((tileType: TileType) => {
    const tileData = getTileData(tileType);
    
    switch (tileType) {
      case 'calendar':
        return (
          <div key="calendar" className="h-full">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
              <div className="mb-5 flex justify-between">
                <div className="flex items-start">
                  <div className="mr-auto">
                    <div className="text-5xl font-bold">{day}</div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div className="capitalize text-sm">{weekday}</div>
                      <div className="capitalize text-sm">{month}</div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Calendar className="h-5 w-5 text-primary" />
                  </Button>
                  <div className="drag-handle cursor-move">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {data.events && data.events.length > 0 ? (
                  data.events.map((event: any, index: number) => (
                    <div key={index} className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg cursor-pointer group">
                      <div className="text-xs font-medium text-primary">
                        {new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(event.end.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="mt-1.5 font-medium text-sm group-hover:text-primary transition-colors">
                        {event.subject}
                      </div>
                      {event.location?.displayName && (
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/60"></div>
                          {event.location.displayName}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No events scheduled for today
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-medium h-8 mt-3"
              >
                View calendar
              </Button>
            </div>
          </div>
        );
      
      case 'planner':
        return (
          <div key="planner" className="h-full">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-medium">Tasks</h2>
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add task
                  </Button>
                  <div className="drag-handle cursor-move">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {data.plannerTasks && data.plannerTasks.length > 0 ? (
                  data.plannerTasks.map((task: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg cursor-pointer group">
                      <div className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-muted-foreground">
                          {task.dueDateTime ? new Date(task.dueDateTime).toLocaleDateString() : 'No due date'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            task.percentComplete === 100 ? "bg-green-500" : 
                            task.percentComplete > 0 ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"
                          )}></div>
                          <span className="text-xs text-muted-foreground">
                            {task.percentComplete === 100 ? "Completed" : 
                             task.percentComplete > 0 ? "In progress" : "Not started"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No tasks found
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-medium h-8 mt-3"
              >
                All tasks
              </Button>
            </div>
          </div>
        );
      
      case 'teams_channel':
        return (
          <div key="teams_channel" className="h-full">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
              <div className="mb-5 flex justify-between">
                <h2 className="font-medium">Teams channel messages</h2>
                <div className="drag-handle cursor-move">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9 bg-muted/30 border border-muted text-sm" 
                  placeholder="Search your channel messages" 
                  onClick={() => router.push('/search/normal?contentTypes=teams&focus=true')}
                />
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {data.channelMessages && data.channelMessages.length > 0 ? (
                  data.channelMessages.map((message: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 py-2 cursor-pointer group"
                      onClick={() => handleChannelMessageClick(message)}
                    >
                      <div className="flex-shrink-0 h-8 w-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">
                        {message.from?.user?.displayName?.charAt(0) || message.from?.application?.displayName?.charAt(0) || "T"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                          {message.teamName || "Unknown Team"} • {message.channelName || "Unknown Channel"}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span className="font-medium">{message.from?.user?.displayName || message.from?.application?.displayName || "Team Member"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                        </div>
                        {message.createdDateTime && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(message.createdDateTime).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No recent channel messages
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-medium h-8 mt-3"
                onClick={() => router.push('/search/normal?contentTypes=teams')}
              >
                All channel messages
              </Button>
            </div>
          </div>
        );
      
      case 'teams_message':
        return (
          <div key="teams_message" className="h-full">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
              <div className="mb-5 flex justify-between">
                <h2 className="font-medium">Teams chat messages</h2>
                <div className="drag-handle cursor-move">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9 bg-muted/30 border border-muted text-sm" 
                  placeholder="Search your chat messages" 
                  onClick={() => router.push('/search/normal?contentTypes=teams_chat&focus=true')}
                />
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {data.teamsMessages && data.teamsMessages.length > 0 ? (
                  data.teamsMessages.slice(0, 5).map((message: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 py-2 cursor-pointer group"
                      onClick={() => handleTeamsMessageClick(message)}
                    >
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                        {message.from?.user?.displayName?.charAt(0) || "T"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                          {(message.chatType === 'oneOnOne' || message.chatType === 'meeting') ? (
                            message.from?.user?.displayName || 'Unknown User'
                          ) : (
                            message.chatName || 'Group Chat'
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                        </div>
                        {message.createdDateTime && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(message.createdDateTime).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No recent chat messages
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-medium h-8 mt-3"
                onClick={() => router.push('/search/normal?contentTypes=teams_chat')}
              >
                All chat messages
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  }, [day, weekday, month, data, router, handleChannelMessageClick, handleTeamsMessageClick]);

  // Memoized renderers for specific tiles
  const renderEmailTile = useCallback(() => (
    <div key="email" className="h-full">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
        <div className="mb-5 flex justify-between">
          <h2 className="font-medium">Email messages</h2>
          <div className="drag-handle cursor-move">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 bg-muted/30 border border-muted text-sm" 
            placeholder="Search your emails" 
            onClick={() => router.push('/search/normal?contentTypes=email&focus=true')}
          />
        </div>
        
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {data.emails && data.emails.length > 0 ? (
            data.emails.map((email: any, index: number) => (
              <div key={index} className="flex flex-col py-1.5 cursor-pointer group">
                <div className="flex items-start gap-3"
                  onClick={() => {
                    try {
                      // Tilbakestill fetching-tilstand før vi åpner ny e-post
                      setHasAttemptedFetch(false);
                      setEmailThreadLoading(false);
                      
                      // Store the email for the detail view
                      if (email.conversationId) {
                        console.log(`Opening email with conversationId: ${email.conversationId}`);
                        setSelectedEmailThread({
                          id: email.conversationId,
                          subject: email.subject || "No subject",
                          latestEmail: email,
                          emails: [email] // Initialize with current email
                        });
                        // Setter dialog open først etter at thread er satt opp
                        setTimeout(() => {
                          setEmailDetailOpen(true);
                        }, 10);
                      } else {
                        // If no conversation ID, just show this single email
                        console.log("Opening single email without conversationId");
                        setSelectedEmailThread({
                          id: email.id,
                          subject: email.subject || "No subject",
                          latestEmail: email,
                          emails: [email]
                        });
                        setHasAttemptedFetch(true); // Don't try to fetch without a conversation ID
                        setEmailDetailOpen(true);
                      }
                    } catch (err) {
                      console.error("Failed to open email detail view:", err);
                      toast.error("Kunne ikke åpne e-post. Prøv igjen.");
                    }
                  }}>
                  <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                    {email.from?.emailAddress?.name?.charAt(0) || "E"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium group-hover:text-primary transition-colors">
                      {email.from?.emailAddress?.name || "Unknown Sender"}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground mt-0.5">
                      {email.subject || "No subject"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {email.bodyPreview || "No preview available"}
                    </div>
                    {email.receivedDateTime && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(email.receivedDateTime).toLocaleDateString()}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            // Store the email in localStorage for the AI chat
                            const emailKey = `email_${email.id}`;
                            localStorage.setItem(emailKey, JSON.stringify(email));
                            
                            // Navigate to AI chat page with email ID and subject
                            window.open(
                              `/ai-services/email/chat?id=${encodeURIComponent(email.id)}&subject=${encodeURIComponent(email.subject || "Email")}`,
                              "_blank"
                            );
                          } catch (err) {
                            console.error("Failed to open email in AI chat:", err);
                          }
                        }}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        AI Chat
                      </Button>
                      {email.webLink && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(email.webLink, "_blank");
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Outlook
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              No recent emails
            </div>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs font-medium h-8 mt-3"
          onClick={() => router.push('/search/normal?contentTypes=email')}
        >
          All emails
        </Button>
      </div>
    </div>
  ), [data.emails, router, setSelectedEmailThread, setEmailDetailOpen, setHasAttemptedFetch, setEmailThreadLoading]);

  const renderFilesTile = useCallback(() => (
    <div key="files" className="h-full">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 h-full overflow-hidden flex flex-col">
        <div className="mb-5 flex justify-between">
          <h2 className="font-medium">Recent files</h2>
          <div className="drag-handle cursor-move">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 bg-muted/30 border border-muted text-sm" 
            placeholder="Search your files" 
            onClick={() => router.push('/search/normal?contentTypes=file&focus=true')}
          />
        </div>
        
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {data.files && data.files.length > 0 ? (
            data.files.slice(0, 20).map((file: any, index: number) => (
              <div 
                key={index} 
                className="flex items-start gap-3 py-1.5 cursor-pointer group"
                onClick={() => handleDashboardFileSelect(file)}
              >
                <div className="flex-shrink-0 h-8 w-8 bg-emerald-500 text-white rounded flex items-center justify-center text-xs">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {file.name || "Unknown file"}
                  </div>
                  {file.webUrl && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new URL(file.webUrl).hostname.replace('www.', '')}
                    </div>
                  )}
                  {file.lastModifiedDateTime && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(file.lastModifiedDateTime).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              No recent files
            </div>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs font-medium h-8 mt-3"
          onClick={() => router.push('/search/normal?contentTypes=file')}
        >
          All files
        </Button>
      </div>
    </div>
  ), [data.files, router, handleDashboardFileSelect]);

  // Generate grid layout based on preferences - NOW moved AFTER all the required functions
  const gridItems = useMemo(() => {
    if (!preferences || !preferences.enabledTiles) return [];
    
    return (preferences.enabledTiles as TileType[]).map((tileType: TileType) => {
      if (tileType === 'email') return renderEmailTile();
      if (tileType === 'files') return renderFilesTile();
      return renderTile(tileType);
    }).filter(Boolean);
  }, [preferences.enabledTiles, renderTile, renderEmailTile, renderFilesTile]);

  // First effect: Check cache immediately on mount, before any user data is loaded
  useEffect(() => {
    // Immediately attempt to load from cache
    const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
    
    if (cachedData && cachedData.data) {
      const cacheAge = cachedData.timestamp ? 
        (new Date().getTime() - new Date(cachedData.timestamp).getTime()) / 1000 : 
        Infinity;
        
      console.log(`Found cached dashboard data from ${cacheAge.toFixed(0)}s ago`);
      
      // Set data and loading states immediately from cache
      setData(cachedData.data);
      setLastRefreshed(cachedData.timestamp ? new Date(cachedData.timestamp) : new Date());
      setIsFreshData(false);
      setIsLoading(false);
      
      if (cachedData.preferences) {
        setPreferences(cachedData.preferences);
        setPreferencesLoaded(true);
        
        // Apply theme from cached preferences
        if (cachedData.preferences.theme) {
          setTheme(cachedData.preferences.theme);
        }
      }
    } else {
      console.log('No cached data found');
    }
    
    setCacheLoaded(true);
  }, []); // This effect only runs once on mount

  // Second effect: User data-dependent operations with debouncing
  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) return;
    if (!cacheLoaded) return;
    
    // If user is navigating away, don't fetch
    if (isNavigatingFromDashboard) return;
    
    // If we don't have preferences yet, load them
    if (!preferencesLoaded) {
      console.log('Loading preferences from DB');
      loadPreferences();
    }
    
    // Determine if we need to fetch data
    const shouldFetchFreshData = () => {
      // No data at all - must fetch
      if (Object.keys(data).length === 0) return true;
      
      // Check if cache is expired
      if (lastRefreshed) {
        const cacheAge = (new Date().getTime() - lastRefreshed.getTime()) / 1000;
        return cacheAge > DEFAULT_CACHE_EXPIRY;
      }
      
      return true;
    };
    
    // Fetch if needed, with a small delay to avoid immediate fetch on mount
    if (shouldFetchFreshData()) {
      const timer = setTimeout(() => {
        console.log('Cache needs refresh, fetching data');
        fetchData(Object.keys(data).length > 0);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, userLoading, cacheLoaded, isNavigatingFromDashboard, preferencesLoaded, data]);

  // Apply theme whenever it changes
  useEffect(() => {
    if (preferences.theme) {
      setTheme(preferences.theme);
    }
  }, [preferences.theme, setTheme]);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: allPrefs, error: fetchError } = await supabase
        .from("dashboard_preferences")
        .select("enabled_tiles,tile_order,updated_at,tile_preferences,theme")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error("Error loading preferences:", fetchError);
        return;
      }

      if (allPrefs && allPrefs.length > 0) {
        const userPrefs = allPrefs[0];
        
        // Convert from DB format to our format
        const loadedPrefs = {
          enabledTiles: userPrefs.enabled_tiles || defaultPreferences.enabledTiles,
          tileOrder: userPrefs.tile_order || defaultPreferences.tileOrder,
          tilePreferences: userPrefs.tile_preferences || defaultPreferences.tilePreferences,
          theme: userPrefs.theme || defaultPreferences.theme,
        };

        // Ensure all required tiles exist in preferences
        for (const tile of defaultTiles) {
          if (!loadedPrefs.tilePreferences[tile]) {
            loadedPrefs.tilePreferences[tile] = defaultTilePreferences;
          }
        }

        setPreferences(loadedPrefs);

        // Also update cached preferences
        const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
        if (cachedData) {
          setToLocalStorage(DASHBOARD_CACHE_KEY, {
            ...cachedData,
            preferences: loadedPrefs,
          });
        }

        // Apply theme if needed
        if (loadedPrefs.theme) {
          setTheme(loadedPrefs.theme);
        }
      } else {
        console.log("No preferences found, using defaults");
      }

      setPreferencesLoaded(true);
    } catch (error) {
      console.error("Error in loadPreferences:", error);
      setPreferencesLoaded(true); // Still mark as loaded to avoid infinite retries
    }
  }, [user?.id, setTheme]);

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (!user?.id) return;
    
    try {
      // Only set loading if this is not a background refresh
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }

      // Limit fetch to enabled tiles only
      const result = await getData(preferences.enabledTiles as TileType[], false);
      
      if (result) {
        setData(result);
        setIsFreshData(true);
        
        const now = new Date();
        setLastRefreshed(now);
        
        // Cache the results along with timestamp and preferences
        setToLocalStorage(DASHBOARD_CACHE_KEY, {
          data: result,
          timestamp: now.toISOString(),
          preferences,
        });
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      toast.error("Failed to refresh dashboard data");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, preferences]);

  const handleManualRefresh = useCallback(() => {
    if (refreshing) return;
    fetchData(true);
    toast.success("Refreshing dashboard data");
  }, [refreshing, fetchData]);

  const handlePreferencesChange = useCallback((newPreferences: any) => {
    if (!user?.id) {
      console.log("Cannot save preferences, no user ID");
      return;
    }

    // Update the state
    setPreferences(newPreferences);

    // Update the cache
    const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
    if (cachedData) {
      setToLocalStorage(DASHBOARD_CACHE_KEY, {
        ...cachedData,
        preferences: newPreferences,
      });
    }

    // Save to database (debounced to avoid excessive updates)
    savePreferencesToDb(newPreferences);

    // Apply theme change immediately if needed
    if (newPreferences.theme !== preferences.theme) {
      setTheme(newPreferences.theme);
    }
  }, [user?.id, preferences.theme, setTheme]);

  // Throttled function to avoid excessive database writes
  const savePreferencesToDb = useCallback(async (prefs: any) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("dashboard_preferences").upsert({
        user_id: user.id,
        enabled_tiles: prefs.enabledTiles,
        tile_order: prefs.tileOrder,
        tile_preferences: prefs.tilePreferences,
        theme: prefs.theme,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving preferences:", error);
        toast.error("Failed to save dashboard preferences");
      }
    } catch (err) {
      console.error("Exception saving preferences:", err);
      toast.error("Failed to save dashboard preferences");
    }
  }, [user?.id]);

  // Navigation helpers
  const navigateToSearch = useCallback(() => {
    router.push('/search/normal');
  }, [router]);

  const openInTeams = useCallback((webUrl: string) => {
    if (webUrl) {
      window.open(webUrl, '_blank');
    } else {
      toast.error("Link til Teams er ikke tilgjengelig");
    }
  }, []);
  
  // Helper to check if two Teams messages are from the same chat
  const isSameChat = useCallback((msg1: any, msg2: any) => {
    if (!msg1 || !msg2) return false;
    
    // Check if it's the exact same URL
    if (msg1.webUrl === msg2.webUrl) return true;
    
    try {
      // Extract UUIDs from the URLs for comparison
      const msg1Uuids = msg1.webUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
      const msg2Uuids = msg2.webUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
      
      // Consider a match if they share at least 2 UUIDs (the users involved)
      let sharedUuids = 0;
      for (const uuid of msg1Uuids) {
        if (msg2Uuids.includes(uuid)) {
          sharedUuids++;
        }
      }
      
      return sharedUuids >= 2;
    } catch (e) {
      return false;
    }
  }, []);

  // Initialize layouts based on preferences
  useEffect(() => {
    if (preferences.enabledTiles.length > 0) {
      // Only initialize layouts if they don't already exist
      const existingLayouts = getFromLocalStorage('dashboard_layouts');
      const layoutVersion = getFromLocalStorage('dashboard_layout_version');
      
      if (!existingLayouts || layoutVersion !== '1.3') {
        initializeDefaultLayouts();
      } else {
        setLayouts(existingLayouts);
      }
    }
  }, [preferences.enabledTiles]);

  // Initialize default layouts - memoized to avoid recreating
  const initializeDefaultLayouts = useCallback(() => {
    // Create a basic layout for different breakpoints
    const defaultLayouts = {
      lg: [
        { i: 'calendar', x: 0, y: 0, w: 4, h: 6 },
        { i: 'planner', x: 4, y: 0, w: 4, h: 6 },
        { i: 'teams_channel', x: 8, y: 0, w: 4, h: 7 },
        { i: 'teams_message', x: 0, y: 6, w: 4, h: 7 },
        { i: 'files', x: 4, y: 6, w: 4, h: 6 },
        { i: 'email', x: 8, y: 7, w: 4, h: 7 },
      ],
      md: [
        { i: 'calendar', x: 0, y: 0, w: 6, h: 6 },
        { i: 'planner', x: 6, y: 0, w: 6, h: 6 },
        { i: 'teams_channel', x: 0, y: 6, w: 6, h: 7 },
        { i: 'teams_message', x: 6, y: 6, w: 6, h: 7 },
        { i: 'files', x: 0, y: 13, w: 6, h: 6 },
        { i: 'email', x: 6, y: 13, w: 6, h: 7 },
      ],
      sm: [
        { i: 'calendar', x: 0, y: 0, w: 12, h: 6 },
        { i: 'planner', x: 0, y: 6, w: 12, h: 6 },
        { i: 'teams_channel', x: 0, y: 12, w: 12, h: 7 },
        { i: 'teams_message', x: 0, y: 19, w: 12, h: 7 },
        { i: 'files', x: 0, y: 26, w: 12, h: 6 },
        { i: 'email', x: 0, y: 32, w: 12, h: 7 },
      ],
      xs: [
        { i: 'calendar', x: 0, y: 0, w: 1, h: 6 },
        { i: 'planner', x: 0, y: 6, w: 1, h: 6 },
        { i: 'teams_channel', x: 0, y: 12, w: 1, h: 7 },
        { i: 'teams_message', x: 0, y: 19, w: 1, h: 7 },
        { i: 'files', x: 0, y: 26, w: 1, h: 6 },
        { i: 'email', x: 0, y: 32, w: 1, h: 7 },
      ]
    };
    
    localStorage.setItem('dashboard_layout_version', '1.3');
    setLayouts(defaultLayouts);
    localStorage.setItem('dashboard_layouts', JSON.stringify(defaultLayouts));
  }, []);

  // Handle layout changes - throttled to reduce performance impact
  const handleLayoutChange = useCallback((currentLayout: any, allLayouts: any) => {
    // Use requestAnimationFrame to throttle updates
    if (!isDragging && !isResizing) {
      requestAnimationFrame(() => {
        setLayouts(allLayouts);
        localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
      });
    }
  }, [isDragging, isResizing]);

  // Reset enabled tiles to default
  const handleResetTiles = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      enabledTiles: defaultPreferences.enabledTiles as TileType[],
      tileOrder: defaultPreferences.tileOrder
    }));
  }, []);

  // Display loading state
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Main render logic for the dashboard
  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You need to be logged in to view this page.</p>
        <Button asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
      </div>
    );
  }

  // Show loading skeleton while initial data loads
  if (isLoading && Object.keys(data).length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 space-y-4 max-w-[1920px]">
        <div className="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lastRefreshed && `Last updated ${formatDistanceToNow(lastRefreshed, { locale: nb, addSuffix: true })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
            </Button>
            <NotificationBell />
            <DashboardPreferences
              userId={user.id}
              onPreferencesChange={handlePreferencesChange}
              initialPreferences={preferences as any}
            />
          </div>
        </div>

        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 1 }}
          rowHeight={40}
          onLayoutChange={handleLayoutChange}
          onDragStart={() => setIsDragging(true)}
          onDragStop={() => setIsDragging(false)}
          onResizeStart={() => setIsResizing(true)}
          onResizeStop={() => setIsResizing(false)}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".drag-handle"
          useCSSTransforms={true}
          compactType="vertical"
          margin={[12, 12]}
        >
          {gridItems}
        </ResponsiveGridLayout>
      </div>

      {/* Dialogs and modals */}
      {selectedTeamsMessage && (
        <TeamsMessageDialog
          message={selectedTeamsMessage}
          isOpen={teamsMessagePreviewOpen}
          onClose={() => {
            setTeamsMessagePreviewOpen(false);
            setSelectedTeamsMessage(null);
          }}
        />
      )}

      {selectedChannelMessage && (
        <TeamsMessageDialog
          message={selectedChannelMessage}
          isOpen={channelPreviewOpen}
          onClose={() => {
            setChannelPreviewOpen(false);
            setSelectedChannelMessage(null);
          }}
        />
      )}

      {selectedDashboardFile && (
        <FileSearchDialog
          file={selectedDashboardFile}
          isOpen={filePreviewUrl !== null}
          onClose={() => {
            setSelectedDashboardFile(null);
            setFilePreviewUrl(null);
          }}
          previewUrl={filePreviewUrl}
        />
      )}

      {selectedEmailThread && (
        <EmailDialog
          email={selectedEmailThread.latestEmail}
          thread={selectedEmailThread.emails || []}
          isOpen={emailDetailOpen}
          onClose={() => {
            setEmailDetailOpen(false);
            setTimeout(() => {
              setSelectedEmailThread(null);
              setHasAttemptedFetch(false);
              setEmailThreadLoading(false);
            }, 300);
          }}
          isLoading={emailThreadLoading}
          key={`email-dialog-${selectedEmailThread.id}`}
        />
      )}
    </div>
  );
}
