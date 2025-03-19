"use client";

import { useState, useEffect } from "react";
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
import { AlertCircle, Info, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { TeamsDialog } from "@/components/TeamsDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
// Default cache expiry time in seconds (5 minutes)
const DEFAULT_CACHE_EXPIRY = 300;

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
    
  }, [user, userLoading, cacheLoaded]); // Only run when auth state changes

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
        .limit(1)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (allPrefs) {
        // Set preferences in state, using defaults for any missing fields
        const newPreferences = {
          enabledTiles:
            allPrefs.enabled_tiles || defaultPreferences.enabledTiles,
          tileOrder: allPrefs.tile_order || defaultPreferences.tileOrder,
          tilePreferences: allPrefs.tile_preferences || defaultPreferences.tilePreferences,
          theme: allPrefs.theme || defaultPreferences.theme,
        };
        
        console.log('Loaded preferences from database:', newPreferences);
        setPreferences(newPreferences);
        
        // Update the theme
        if (newPreferences.theme) {
          setTheme(newPreferences.theme);
        }
      } else {
        // No preferences found, create default without the new columns
        console.log('No preferences found, creating defaults');
        const { error: createError } = await supabase
          .from("dashboard_preferences")
          .insert({
            user_id: user.id,
            enabled_tiles: defaultPreferences.enabledTiles,
            tile_order: defaultPreferences.tileOrder,
            tile_preferences: defaultPreferences.tilePreferences,
            theme: defaultPreferences.theme,
            updated_at: new Date().toISOString(),
          });

        if (createError) {
          console.error("Error creating default preferences:", createError);
        }
      }
    } catch (err) {
      console.error("Error loading preferences:", err);
      // Use default values if there's an error
      setPreferences(defaultPreferences);
    } finally {
      setPreferencesLoaded(true);
    }
  };

  const fetchData = async (isBackgroundRefresh = false) => {
    if (!user?.id) {
      console.log('FETCH: No user ID, aborting fetch');
      return;
    }
    
    try {
      if (!isBackgroundRefresh) {
        console.log('FETCH: Foreground fetch starting - showing loading state');
        setIsLoading(true);
      } else {
        console.log('FETCH: Background fetch starting - showing refresh indicator');
        setRefreshing(true);
      }
      
      console.log(`FETCH: Getting data from server (background: ${isBackgroundRefresh})`);
      const result = await getData();
      
      if (!result.error) {
        console.log('FETCH: Data received successfully');
        
        setData(result);
        const now = new Date();
        setLastRefreshed(now);
        setIsFreshData(true);
        
        // Cache the data with a timestamp and user info
        const cacheData = {
          data: result,
          timestamp: now.toISOString(),
          preferences: preferences,
          userId: user.id,
        };
        
        setToLocalStorage(DASHBOARD_CACHE_KEY, cacheData);
        console.log('FETCH: Dashboard data cached successfully');
      } else {
        console.error('FETCH: Error in API response:', result.error);
        
        // Only show errors if not a background refresh
        if (!isBackgroundRefresh) {
          setData(result);
          toast.error(`Error: ${result.error}`);
        }
      }
    } catch (err: any) {
      console.error("FETCH: Error fetching data:", err);
      if (!isBackgroundRefresh) {
        toast.error(err?.message || "Error loading dashboard data");
      }
    } finally {
      // Make sure to update loading states
      if (!isBackgroundRefresh) {
        console.log('FETCH: Foreground fetch complete, hiding loading state');
        setIsLoading(false);
      } else {
        console.log('FETCH: Background fetch complete, hiding refresh indicator');
      }
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    console.log('MANUAL: User triggered manual refresh');
    
    // Show a toast notification
    toast.success("Refreshing dashboard...");
    
    // Clear the fresh data flag since we're actively refreshing
    setIsFreshData(false);
    
    // Start a foreground refresh
    fetchData(false);
  };

  const handlePreferencesChange = (newPreferences: DashboardPreferences) => {
    setPreferences(newPreferences);
    
    // Update the cache with new preferences
    if (user?.id) {
      const cachedData = getFromLocalStorage(DASHBOARD_CACHE_KEY);
      if (cachedData) {
        const updatedCache = {
          ...cachedData,
          preferences: newPreferences,
        };
        setToLocalStorage(DASHBOARD_CACHE_KEY, updatedCache);
      }
    }
  };

  if (userLoading || !cacheLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
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
          userId: data.userId
        };
      case "teams_message":
        return {
          messages: data.teamsMessages || [],
          isLoading: shouldShowLoading(data.teamsMessages),
          userId: data.userId,
          isCachedData: !isFreshData
        };
      case "teams_channel":
        return {
          messages: data.channelMessages || [],
          isLoading: shouldShowLoading(data.channelMessages),
          userId: data.userId,
          isCachedData: !isFreshData
        };
      case "calendar":
        return { 
          events: data.events || [], 
          isLoading: !Array.isArray(data.events) || (isLoading && (!data.events || data.events.length === 0) && !isFreshData),
          isCachedData: !isFreshData,
          userId: data.userId
        };
      case "files":
        return { 
          files: data.files || [], 
          isLoading: shouldShowLoading(data.files),
          isCachedData: !isFreshData,
          userId: data.userId
        };
      case "planner":
        return {
          tasks: data.plannerTasks || [],
          isLoading: shouldShowLoading(data.plannerTasks),
          userId: data.userId,
          refreshInterval:
            preferences.tilePreferences.planner.refreshInterval * 1000, // Convert to milliseconds
          onRefresh: async () => {
            try {
              console.log('Refreshing planner tasks via tile refresh');
              setRefreshing(true);
              
              const result = await getData(['planner']);
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
              } else if (result.error) {
                console.error('Error refreshing planner tasks:', result.error);
                toast.error(`Failed to refresh: ${result.error}`);
              }
            } catch (err) {
              console.error("Error refreshing planner data:", err);
              toast.error("Failed to refresh planner tasks");
            } finally {
              setRefreshing(false);
            }
          },
          isCachedData: !isFreshData
        };
      default:
        return {};
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 space-y-4 max-w-[1920px]">
        {/* Header Section - Reduced padding and spacing */}
        <div className="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your workspace at a glance
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isFreshData && lastRefreshed && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mr-1" />
                <span>
                  Cached data from {lastRefreshed.toLocaleTimeString()} 
                  {refreshing && <span className="ml-1">• refreshing...</span>}
                </span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTeamsDialogOpen(true)}
              className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors"
            >
              <Users className="h-4 w-4" />
            </Button>
            <DashboardPreferences
              userId={user?.id || ""}
              onPreferencesChange={handlePreferencesChange}
              initialPreferences={preferences}
            />
          </div>
        </div>

        {/* Main Content - Tighter grid with smaller gaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {preferences.enabledTiles.map((tileType, index) => {
            const TileComponent = tileComponents[tileType];
            const tileData = getTileData(tileType);
            const tilePrefs = preferences.tilePreferences[tileType];

            return (
              <div
                key={tileType}
                className={cn(
                  "transition-all duration-200 ease-in-out rounded-lg shadow-sm",
                  tilePrefs.size === "compact" && "h-[280px]",
                  tilePrefs.size === "normal" && "h-[350px]",
                  tilePrefs.size === "large" && "h-[450px]",
                  "hover:shadow-md hover:scale-[1.01] hover:bg-background/50"
                )}
                style={{ order: preferences.tileOrder[index] }}
              >
                <TileComponent
                  {...tileData}
                  refreshInterval={tilePrefs.refreshInterval * 1000}
                  isCachedData={!isFreshData}
                />
              </div>
            );
          })}
        </div>

        {!userLoading && (
          <TeamsDialog
            isOpen={teamsDialogOpen}
            onClose={() => setTeamsDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
