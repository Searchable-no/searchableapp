"use client";

import { useState, useEffect, useCallback } from "react";
import { EmailTile } from "@/components/EmailTile";
import { TeamsMessageTile } from "@/components/TeamsMessageTile";
import { TeamsChannelTile } from "@/components/TeamsChannelTile";
import { CalendarTile } from "@/components/CalendarTile";
import { RecentFilesTile } from "@/components/RecentFilesTile";
import { DashboardPreferences } from "@/components/DashboardPreferences";
import { TileType } from "@/lib/database.types";
import { getData } from "./actions";
import { useUser } from "@/lib/hooks";
import { supabase } from "@/lib/supabase-browser";
import { PlannerTile } from "@/components/PlannerTile";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { AlertCircle, Info, RefreshCw, Users, Calendar, Search, FileText, Plus, MoreHorizontal, Clock, Home, GripVertical } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { TeamsDialog } from "@/components/TeamsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const tileComponents: Record<TileType, React.ComponentType<any>> = {
  email: EmailTile,
  teams_message: TeamsMessageTile,
  teams_channel: TeamsChannelTile,
  calendar: CalendarTile,
  files: RecentFilesTile,
  planner: PlannerTile,
};

const defaultTiles: TileType[] = [
  "email",
  "teams_message",
  "teams_channel",
  "calendar",
  "files",
  "planner",
];
const defaultOrder = [0, 1, 2, 3, 4, 5];

const defaultTilePreferences = {
  size: "normal" as const,
  refreshInterval: 300, // 5 minutes
};

interface DashboardPreferences {
  enabledTiles: TileType[];
  tileOrder: number[];
  tilePreferences: Record<
    TileType,
    {
      size: "compact" | "normal" | "large";
      refreshInterval: number;
    }
  >;
  theme: "light" | "dark" | "system";
}

const defaultPreferences: DashboardPreferences = {
  enabledTiles: defaultTiles,
  tileOrder: defaultOrder,
  tilePreferences: Object.fromEntries(
    defaultTiles.map((tile) => [tile, defaultTilePreferences])
  ) as Record<TileType, typeof defaultTilePreferences>,
  theme: "system",
};

// Helper to safely access localStorage (avoiding SSR issues)
const getFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    console.log(`Retrieved cache for ${key}:`, item ? 'found' : 'not found');
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return null;
  }
};

const setToLocalStorage = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    const valueToStore = JSON.stringify(value);
    localStorage.setItem(key, valueToStore);
    console.log(`Saved ${valueToStore.length} bytes to cache key: ${key}`);
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

// Function to check if cache is expired
const isCacheExpired = (timestamp: string | undefined | null, maxAge: number) => {
  if (!timestamp) return true; // If no timestamp, consider cache expired
  
  try {
    const cacheTime = new Date(timestamp).getTime();
    if (isNaN(cacheTime)) return true; // Invalid date, consider expired
    
    const now = new Date().getTime();
    const ageInSeconds = (now - cacheTime) / 1000;
    return ageInSeconds > maxAge;
  } catch (error) {
    console.error('Error checking cache expiry:', error);
    return true; // On error, consider expired
  }
};

// Cache key for dashboard data
const DASHBOARD_CACHE_KEY = 'dashboard_cache';
// Default cache expiry time in seconds (30 minutes)
const DEFAULT_CACHE_EXPIRY = 1800;

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

export function DashboardClient() {
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFreshData, setIsFreshData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [preferences, setPreferences] =
    useState<DashboardPreferences>(defaultPreferences);
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

  // First effect: Check cache immediately on mount, before any user data is loaded
  useEffect(() => {
    // Immediately attempt to load from cache
    const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
    
    if (cachedData && cachedData.data) {
      console.log('MOUNT: Found cached dashboard data from:', 
        new Date(cachedData.timestamp || Date.now()).toLocaleTimeString());
      
      // Set data and loading states immediately from cache
      setData(cachedData.data);
      setLastRefreshed(new Date(cachedData.timestamp || Date.now()));
      setIsFreshData(false);
      
      // Since we have data, we can show the UI right away
      setIsLoading(false);
      
      if (cachedData.preferences) {
        console.log('MOUNT: Setting preferences from cache');
        setPreferences(cachedData.preferences);
        setPreferencesLoaded(true);
        
        // Apply theme from cached preferences
        if (cachedData.preferences.theme) {
          setTheme(cachedData.preferences.theme);
        }
      }
    } else {
      console.log('MOUNT: No cached data found');
    }
    
    setCacheLoaded(true);
  }, []); // This effect only runs once on mount

  // Second effect: User data-dependent operations
  useEffect(() => {
    if (userLoading) {
      console.log('AUTH: User still loading, waiting...');
      return;
    }
    
    if (!user?.id) {
      console.log('AUTH: No user logged in');
      return;
    }
    
    console.log('AUTH: User authenticated, ID:', user.id);
    
    // If we don't have preferences yet, load them
    if (!preferencesLoaded) {
      console.log('PREFS: Loading preferences from DB');
      loadPreferences();
    }
    
    // Check if we have cache data
    if (Object.keys(data).length === 0) {
      console.log('DATA: No data in state, fetching fresh data');
      fetchData(false);
      return;
    }
    
    // If we're navigating away from dashboard, don't do background refreshes
    if (isNavigatingFromDashboard) {
      console.log('NAVIGATION: User is leaving dashboard, skipping refresh');
      return;
    }
    
    // We have some data - determine if we need a background refresh
    const now = new Date();
    const cacheTimestamp = lastRefreshed || now;
    const cacheAge = (now.getTime() - cacheTimestamp.getTime()) / 1000; // in seconds
    
    console.log(`CACHE: Cache age is ${cacheAge.toFixed(0)} seconds`);
    
    if (isCacheExpired(cacheTimestamp.toISOString(), DEFAULT_CACHE_EXPIRY)) {
      console.log('CACHE: Cache is expired, refreshing in background');
      fetchData(true);
    } else {
      console.log('CACHE: Cache is fresh, no refresh needed');
    }
    
  }, [user, userLoading, cacheLoaded, isNavigatingFromDashboard]); // Add isNavigatingFromDashboard to dependencies

  useEffect(() => {
    // Apply theme whenever it changes
    setTheme(preferences.theme);
  }, [preferences.theme, setTheme]);

  const loadPreferences = async () => {
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
        console.log("Loaded preferences:", userPrefs);

        // Convert from DB format to our format
        const loadedPrefs: DashboardPreferences = {
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
    }
  };

  const fetchData = async (isBackgroundRefresh = false) => {
    if (!user?.id) return;
    
    try {
      // Only set loading if this is not a background refresh
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }

      console.log(`Starting fetch for ${preferences.enabledTiles.join(', ')}`);
      
      // Perform the actual data fetch
      const result = await getData(preferences.enabledTiles, false);
      
      // Handle results
      if (result) {
        console.log('Fetch completed successfully');
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
  };

  const handleManualRefresh = () => {
    if (refreshing) return;
    
    console.log('Manual refresh requested');
    fetchData(true);
    toast.success("Refreshing dashboard data");
  };

  const handlePreferencesChange = (newPreferences: DashboardPreferences) => {
    if (!user?.id) {
      console.log("Cannot save preferences, no user ID");
      return;
    }

    // First update the state
    setPreferences(newPreferences);

    // Also update the preferences in the cache
    const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
    if (cachedData) {
      setToLocalStorage(DASHBOARD_CACHE_KEY, {
        ...cachedData,
        preferences: newPreferences,
      });
    }

    // Then save to the database
    savePreferencesToDb(newPreferences);

    // If the theme has changed, update it
    if (newPreferences.theme !== preferences.theme) {
      setTheme(newPreferences.theme);
    }
  };

  const savePreferencesToDb = async (prefs: DashboardPreferences) => {
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
      } else {
        console.log("Preferences saved successfully");
      }
    } catch (err) {
      console.error("Exception saving preferences:", err);
      toast.error("Failed to save dashboard preferences");
    }
  };

  // Generate data for each tile
  const getTileData = (tileType: TileType) => {
    // Common logic for checking if we should show loading state
    const shouldShowLoading = (dataItems: any[] | undefined) => {
      // If we already have data, don't show loading
      if (dataItems && dataItems.length > 0) return false;
      
      // If we have cached data but no items, still don't show loading 
      // since we want to show "No items" instead of loading skeleton
      if (!isFreshData) return false;
      
      // Otherwise, show loading if we're actively loading
      return isLoading;
    };

    switch (tileType) {
      case "email":
        return { 
          emails: data.emails || [], 
          isLoading: shouldShowLoading(data.emails),
          isCachedData: !isFreshData,
          userId: data.userId,
          onRefresh: async () => {
            try {
              console.log('Refreshing email data');
              setRefreshing(true);
              
              const result = await getData(['email'], true);
              if (result.emails) {
                console.log(`Refreshed ${result.emails.length} emails`);
                
                // Update just the emails in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  emails: result.emails
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      emails: result.emails
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                }
                
                toast.success('Email data refreshed');
              }
            } catch (err) {
              console.error("Error refreshing email data:", err);
              toast.error("Failed to refresh email data");
            } finally {
              setRefreshing(false);
            }
          }
        };
      case "teams_message":
        return {
          messages: data.teamsMessages || [],
          isLoading: shouldShowLoading(data.teamsMessages),
          userId: data.userId,
          isCachedData: !isFreshData,
          onRefresh: async () => {
            try {
              console.log('Refreshing Teams messages');
              setRefreshing(true);
              
              const result = await getData(['teams_message'], true);
              if (result.teamsMessages) {
                console.log(`Refreshed ${result.teamsMessages.length} teams messages`);
                
                // Update just the teams messages in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  teamsMessages: result.teamsMessages
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      teamsMessages: result.teamsMessages
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                }
                
                toast.success('Teams messages refreshed');
              }
            } catch (err) {
              console.error("Error refreshing teams messages:", err);
              toast.error("Failed to refresh teams messages");
            } finally {
              setRefreshing(false);
            }
          }
        };
      case "teams_channel":
        return {
          messages: data.channelMessages || [],
          isLoading: shouldShowLoading(data.channelMessages),
          userId: data.userId,
          isCachedData: !isFreshData,
          onRefresh: async () => {
            try {
              console.log('Refreshing Teams channel messages');
              setRefreshing(true);
              
              const result = await getData(['teams_channel'], true);
              if (result.channelMessages) {
                console.log(`Refreshed ${result.channelMessages.length} channel messages`);
                
                // Update just the channel messages in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  channelMessages: result.channelMessages
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      channelMessages: result.channelMessages
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                }
                
                toast.success('Channel messages refreshed');
              }
            } catch (err) {
              console.error("Error refreshing channel messages:", err);
              toast.error("Failed to refresh channel messages");
            } finally {
              setRefreshing(false);
            }
          }
        };
      case "calendar":
        return { 
          events: data.events || [], 
          isLoading: !Array.isArray(data.events) || (isLoading && (!data.events || data.events.length === 0) && !isFreshData),
          isCachedData: !isFreshData,
          userId: data.userId,
          onRefresh: async () => {
            try {
              console.log('Refreshing calendar events');
              setRefreshing(true);
              
              const result = await getData(['calendar'], true);
              if (result.events) {
                console.log(`Refreshed ${result.events.length} calendar events`);
                
                // Update just the events in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  events: result.events
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      events: result.events
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                }
                
                toast.success('Calendar events refreshed');
              }
            } catch (err) {
              console.error("Error refreshing calendar events:", err);
              toast.error("Failed to refresh calendar events");
            } finally {
              setRefreshing(false);
            }
          }
        };
      case "files":
        return { 
          files: data.files || [], 
          isLoading: shouldShowLoading(data.files),
          isCachedData: !isFreshData,
          userId: data.userId,
          onRefresh: async () => {
            try {
              console.log('Refreshing files');
              setRefreshing(true);
              
              const result = await getData(['files'], true);
              if (result.files) {
                console.log(`Refreshed ${result.files.length} files`);
                
                // Update just the files in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  files: result.files
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      files: result.files
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                }
                
                toast.success('Files refreshed');
              }
            } catch (err) {
              console.error("Error refreshing files:", err);
              toast.error("Failed to refresh files");
            } finally {
              setRefreshing(false);
            }
          }
        };
      case "planner":
        return {
          tasks: data.plannerTasks || [],
          isLoading: shouldShowLoading(data.plannerTasks),
          userId: data.userId,
          refreshInterval:
            preferences.tilePreferences.planner.refreshInterval * 1000, // Convert to milliseconds
          isCachedData: !isFreshData,
          onRefresh: async () => {
            try {
              console.log('Refreshing planner tasks via tile refresh');
              setRefreshing(true);
              
              const result = await getData(['planner'], true);
              if (result.plannerTasks) {
                console.log(`Refreshed ${result.plannerTasks.length} planner tasks`);
                
                // Update just the planner tasks in our data state
                setData((prevData: any) => ({
                  ...prevData,
                  plannerTasks: result.plannerTasks
                }));
                
                // Mark as fresh data
                setIsFreshData(true);
                
                // Update the timestamp
                const now = new Date();
                setLastRefreshed(now);
                
                // Update the cache
                const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
                if (cachedData) {
                  const updatedCache = {
                    ...cachedData,
                    data: {
                      ...cachedData.data,
                      plannerTasks: result.plannerTasks
                    },
                    timestamp: now.toISOString()
                  };
                  setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
                  console.log('Updated planner tasks in cache');
                }
                
                toast.success('Planner tasks refreshed');
              }
            } catch (err) {
              console.error("Error refreshing planner tasks:", err);
              toast.error("Failed to refresh planner tasks");
            } finally {
              setRefreshing(false);
            }
          }
        };
      default:
        return {};
    }
  };

  const navigateToSearch = () => {
    router.push('/search/normal');
  };

  const formatDate = () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    };
    return today.toLocaleDateString('no-NO', options);
  };

  const handleChannelMessageClick = (message: any) => {
    setSelectedChannelMessage(message);
    setChannelPreviewOpen(true);
  };

  const handleTeamsMessageClick = (message: any) => {
    setSelectedTeamsMessage(message);
    setTeamsMessagePreviewOpen(true);
  };

  const openInTeams = (webUrl: string) => {
    if (webUrl) {
      window.open(webUrl, '_blank');
    } else {
      toast.error("Link til Teams er ikke tilgjengelig");
    }
  };
  
  // Helper function to check if two messages are from the same chat
  const isSameChat = (msg1: any, msg2: any) => {
    if (!msg1 || !msg2) return false;
    
    // Check if it's the exact same URL
    if (msg1.webUrl === msg2.webUrl) return true;
    
    try {
      // Extract all UUIDs from the URLs
      const msg1Uuids = msg1.webUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
      const msg2Uuids = msg2.webUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
      
      // Consider a match if they share at least 2 UUIDs (the users involved)
      let sharedUuids = 0;
      for (const uuid of msg1Uuids) {
        if (msg2Uuids.includes(uuid)) {
          sharedUuids++;
        }
      }
      
      return sharedUuids >= 2; // They share at least 2 UUIDs (likely the users in the chat)
    } catch (e) {
      return false;
    }
  };

  // Add a new useEffect to initialize layouts based on preferences
  useEffect(() => {
    if (preferences.enabledTiles.length > 0) {
      // Delete any outdated layouts
      localStorage.removeItem('dashboard_layouts');
      localStorage.removeItem('dashboard_layout_version');
      
      // Force reset layouts for all users to fix responsiveness issue
      initializeDefaultLayouts();
    }
  }, [preferences.enabledTiles]);

  const initializeDefaultLayouts = () => {
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
    
    // Update version to force a refresh for all users
    localStorage.setItem('dashboard_layout_version', '1.3');
    setLayouts(defaultLayouts);
    localStorage.setItem('dashboard_layouts', JSON.stringify(defaultLayouts));
  };

  const handleLayoutChange = (currentLayout: any, allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
  };

  const renderTile = (tileType: TileType) => {
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
      
      case 'files':
        return (
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
                    <div key={index} className="flex items-start gap-3 py-1.5 cursor-pointer group">
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
        );
      
      case 'email':
        return (
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
                    <div key={index} className="flex items-start gap-3 py-1.5 cursor-pointer group">
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                        {email.sender?.emailAddress?.name?.charAt(0) || "E"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                          {email.sender?.emailAddress?.name || "Unknown Sender"}
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
        );
        
      default:
        return null;
    }
  };

  // Display error messages
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <div>Please log in to view your dashboard.</div>;
  }

  if (isLoading || !data || !preferencesLoaded) {
    return <DashboardSkeleton />;
  }

  if (data?.error) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">{data.error}</h2>
          {data.error === "Microsoft account not connected" && (
            <div className="space-y-2">
              <p>
                Please connect your Microsoft account to view your dashboard.
              </p>
              <Link
                href="/settings"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString('default', { month: 'long' });
  const weekday = today.toLocaleString('default', { weekday: 'long' });

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-zinc-900">
      <div className="container mx-auto py-8 px-4 sm:px-6 max-w-screen-xl">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {lastRefreshed && (
              <p className="text-sm text-muted-foreground">
                Sist oppdatert: {formatDistanceToNow(lastRefreshed, { addSuffix: true, locale: nb })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DashboardPreferences
              userId={user?.id || ""}
              onPreferencesChange={handlePreferencesChange}
              initialPreferences={preferences}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1.5"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span>Oppdater</span>
            </Button>
          </div>
        </div>
        
        {/* Responsive Grid Layout */}
        <div className={cn(isDragging ? 'cursor-grabbing' : 'cursor-default')}>
          <style jsx global>{`
            .react-resizable-handle {
              position: absolute;
              width: 100%;
              height: 10px;
              bottom: 0;
              cursor: row-resize;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .react-resizable-handle::after {
              content: "";
              width: 40px;
              height: 3px;
              border-radius: 3px;
              background-color: rgba(100, 100, 100, 0.2);
              transition: all 0.2s ease;
            }
            .react-resizable-handle:hover::after {
              background-color: rgba(100, 100, 100, 0.4);
              height: 4px;
            }
          `}</style>
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 12, xs: 1, xxs: 1 }}
            rowHeight={70}
            onLayoutChange={(currentLayout, allLayouts) => handleLayoutChange(currentLayout, allLayouts)}
            draggableHandle=".drag-handle"
            onDragStart={() => setIsDragging(true)}
            onDragStop={() => setIsDragging(false)}
            onResizeStart={() => setIsResizing(true)}
            onResizeStop={() => setIsResizing(false)}
            margin={[24, 24]}
            containerPadding={[24, 24]}
            isDraggable={true}
            isResizable={true}
            resizeHandles={['s']}
            useCSSTransforms={true}
            preventCollision={false}
            style={{ overflow: 'visible' }}
          >
            {preferences.enabledTiles.map(tileType => renderTile(tileType))}
          </ResponsiveGridLayout>
        </div>
        
        {/* Teams Dialog and other modals */}
        {!userLoading && (
          <TeamsDialog
            isOpen={teamsDialogOpen}
            onClose={() => setTeamsDialogOpen(false)}
          />
        )}

        {/* Channel Preview Dialog */}
        {selectedChannelMessage && (
          <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center ${channelPreviewOpen ? 'block' : 'hidden'}`}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg">
                    {selectedChannelMessage.teamName || "Team"} • {selectedChannelMessage.channelName || "Channel"}
                  </h3>
                  <p className="text-sm text-muted-foreground">Meldinger i denne kanalen</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setChannelPreviewOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  {/* Current message preview */}
                  <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-8 w-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">
                        {selectedChannelMessage.from?.user?.displayName?.charAt(0) || "T"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{selectedChannelMessage.from?.user?.displayName || "Team Member"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(selectedChannelMessage.createdDateTime).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          {selectedChannelMessage.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Other messages in same channel/team */}
                  {data.channelMessages && data.channelMessages
                    .filter((msg: any) => 
                      msg.id !== selectedChannelMessage.id && 
                      msg.teamName === selectedChannelMessage.teamName && 
                      msg.channelName === selectedChannelMessage.channelName)
                    .slice(0, 5)
                    .map((message: any, index: number) => (
                      <div key={index} className="p-3 bg-muted/20 dark:bg-muted/10 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                            {message.from?.user?.displayName?.charAt(0) || "T"}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{message.from?.user?.displayName || "Team Member"}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.createdDateTime).toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm">
                              {message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {data.channelMessages?.filter((msg: any) => 
                    msg.id !== selectedChannelMessage.id && 
                    msg.teamName === selectedChannelMessage.teamName && 
                    msg.channelName === selectedChannelMessage.channelName).length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Ingen flere meldinger i denne kanalen
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 border-t">
                <Button 
                  className="w-full"
                  onClick={() => openInTeams(selectedChannelMessage.webUrl)}
                >
                  Åpne i Teams
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Teams Chat Message Preview Dialog */}
        {selectedTeamsMessage && (
          <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center ${teamsMessagePreviewOpen ? 'block' : 'hidden'}`}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg">
                    Chat med {selectedTeamsMessage.from?.user?.displayName || "Bruker"}
                  </h3>
                  <p className="text-sm text-muted-foreground">Direkte meldinger</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setTeamsMessagePreviewOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  {/* Current message preview */}
                  <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-8 w-8 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">
                        {selectedTeamsMessage.from?.user?.displayName?.charAt(0) || "T"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{selectedTeamsMessage.from?.user?.displayName || "Bruker"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(selectedTeamsMessage.createdDateTime).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          {selectedTeamsMessage.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Other messages from the same chat */}
                  {data.teamsMessages && data.teamsMessages
                    .filter((msg: any) => msg.id !== selectedTeamsMessage.id && isSameChat(msg, selectedTeamsMessage))
                    .slice(0, 5)
                    .map((message: any, index: number) => (
                      <div key={index} className="p-3 bg-muted/20 dark:bg-muted/10 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                            {message.from?.user?.displayName?.charAt(0) || "T"}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{message.from?.user?.displayName || "Bruker"}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.createdDateTime).toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm">
                              {message.content?.replace(/<[^>]*>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || "No message content"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {data.teamsMessages?.filter((msg: any) => 
                    msg.id !== selectedTeamsMessage.id && isSameChat(msg, selectedTeamsMessage)).length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Ingen flere meldinger i denne chatten
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 border-t">
                <Button 
                  className="w-full"
                  onClick={() => openInTeams(selectedTeamsMessage.webUrl)}
                >
                  Åpne i Teams
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
