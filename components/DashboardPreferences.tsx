import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings, GripVertical, Sun, Moon, Monitor } from "lucide-react";
import { TileType } from "@/lib/database.types";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

const tileNames: Record<TileType, string> = {
  email: "Email Messages",
  teams_message: "Teams Messages",
  teams_channel: "Teams Channel Messages",
  calendar: "Calendar Events",
  files: "Recent Files",
  planner: "Planner Tasks",
};

const tileIcons: Record<TileType, React.ReactNode> = {
  email: "📧",
  teams_message: "💬",
  teams_channel: "👥",
  calendar: "📅",
  files: "📁",
  planner: "📋",
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

interface TilePreferences {
  size: "compact" | "normal" | "large";
  refreshInterval: number; // in seconds
}

interface DashboardPreferences {
  enabledTiles: TileType[];
  tileOrder: number[];
  tilePreferences: Record<TileType, TilePreferences>;
  theme: "light" | "dark" | "system";
}

interface DashboardPreferencesProps {
  userId: string;
  onPreferencesChange: (preferences: DashboardPreferences) => void;
  initialPreferences?: DashboardPreferences;
}

const defaultTilePreferences: TilePreferences = {
  size: "normal",
  refreshInterval: 300, // 5 minutes
};

const defaultPreferences: DashboardPreferences = {
  enabledTiles: defaultTiles,
  tileOrder: defaultOrder,
  tilePreferences: Object.fromEntries(
    defaultTiles.map((tile) => [tile, defaultTilePreferences])
  ) as Record<TileType, TilePreferences>,
  theme: "system",
};

const ThemeOption = memo(({ 
  theme, 
  currentTheme, 
  icon: Icon, 
  label, 
  iconColor, 
  onClick 
}: { 
  theme: string, 
  currentTheme: string, 
  icon: any, 
  label: string, 
  iconColor: string,
  onClick: () => void 
}) => (
  <div
    className={cn(
      "flex items-center justify-between p-2 rounded-md border cursor-pointer",
      currentTheme === theme && "bg-muted/50"
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
      {currentTheme === theme && (
        <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
      )}
    </div>
  </div>
));
ThemeOption.displayName = 'ThemeOption';

const TileRow = memo(({ 
  tile, 
  index, 
  isEnabled, 
  preferences, 
  toggleTile, 
  updateTilePreference, 
  provided 
}: { 
  tile: TileType, 
  index: number, 
  isEnabled: boolean, 
  preferences: DashboardPreferences, 
  toggleTile: (tile: TileType) => void, 
  updateTilePreference: (tile: TileType, key: keyof TilePreferences, value: any) => void,
  provided?: DraggableProvided 
}) => (
  <div
    ref={provided ? provided.innerRef : undefined}
    {...(provided?.draggableProps || {})}
    className={cn(
      "flex items-center justify-between p-2 rounded-md border",
      isEnabled ? "bg-muted/50" : "bg-background"
    )}
  >
    <div
      {...(provided?.dragHandleProps || {})}
      className="flex items-center gap-2"
    >
      {isEnabled && <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />}
      <div className="flex items-center gap-1.5">
        <span className="text-base">{tileIcons[tile]}</span>
        <span className="text-xs font-medium">{tileNames[tile]}</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {isEnabled && (
        <Select
          value={preferences.tilePreferences[tile]?.size || "normal"}
          onValueChange={(value) =>
            updateTilePreference(tile, "size", value as any)
          }
        >
          <SelectTrigger className="w-[100px] h-7 text-xs">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact" className="text-xs">Compact</SelectItem>
            <SelectItem value="normal" className="text-xs">Normal</SelectItem>
            <SelectItem value="large" className="text-xs">Large</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Switch
        id={`tile-${tile}`}
        checked={isEnabled}
        onCheckedChange={() => toggleTile(tile)}
        className="scale-75"
      />
    </div>
  </div>
));
TileRow.displayName = 'TileRow';

export const DashboardPreferences = memo(({
  userId,
  onPreferencesChange,
  initialPreferences = defaultPreferences,
}: DashboardPreferencesProps) => {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<DashboardPreferences>(initialPreferences);
  const [saving, setSaving] = useState(false);
  
  // All available tiles
  const allTiles: TileType[] = [
    "email",
    "teams_message",
    "teams_channel",
    "calendar",
    "files",
    "planner",
  ];

  // Sync with initialPreferences when they change
  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  // Save preferences to database
  const savePreferences = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      // Basic save with error handling
      const { error } = await supabase.from("dashboard_preferences").upsert({
        user_id: userId,
        enabled_tiles: preferences.enabledTiles,
        tile_order: preferences.tileOrder,
        tile_preferences: preferences.tilePreferences,
        theme: preferences.theme,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving preferences:", error);
        toast.error("Failed to save dashboard preferences");
        return;
      }

      // Notify parent
      onPreferencesChange(preferences);
      toast.success("Dashboard preferences saved");
      setOpen(false);
    } catch (err) {
      console.error("Exception saving preferences:", err);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }, [saving, userId, preferences, onPreferencesChange]);

  // Toggle tile enabled/disabled
  const toggleTile = useCallback((tile: TileType) => {
    setPreferences((prev) => {
      if (prev.enabledTiles.includes(tile)) {
        // Remove tile
        const newEnabledTiles = prev.enabledTiles.filter((t) => t !== tile);
        const newTileOrder = prev.tileOrder.filter(
          (_, index) => index < newEnabledTiles.length
        );
        return {
          ...prev,
          enabledTiles: newEnabledTiles,
          tileOrder: newTileOrder,
        };
      } else {
        // Add tile
        const newEnabledTiles = [...prev.enabledTiles, tile];
        const newTileOrder = [...prev.tileOrder, prev.tileOrder.length];
        return {
          ...prev,
          enabledTiles: newEnabledTiles,
          tileOrder: newTileOrder,
        };
      }
    });
  }, []);

  // Handle drag and drop
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(preferences.enabledTiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const newOrder = items.map((_, index) => index);

    setPreferences((prev) => ({
      ...prev,
      enabledTiles: items,
      tileOrder: newOrder,
    }));
  }, [preferences.enabledTiles]);

  // Update a single tile preference
  const updateTilePreference = useCallback((
    tile: TileType,
    key: keyof TilePreferences,
    value: any
  ) => {
    setPreferences((prev) => ({
      ...prev,
      tilePreferences: {
        ...prev.tilePreferences,
        [tile]: {
          ...prev.tilePreferences[tile],
          [key]: value,
        },
      },
    }));
  }, []);

  // Update theme
  const updateTheme = useCallback((theme: "light" | "dark" | "system") => {
    setPreferences((prev) => ({
      ...prev,
      theme,
    }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg">Dashboard Preferences</DialogTitle>
          <DialogDescription className="text-sm">
            Customize your dashboard layout and appearance.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tiles" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tiles" className="text-xs">Tiles</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs">Appearance</TabsTrigger>
            <TabsTrigger value="behavior" className="text-xs">Behavior</TabsTrigger>
          </TabsList>

          <TabsContent value="tiles" className="space-y-3 mt-2">
            <Card>
              <CardContent className="pt-4 pb-3">
                <CardDescription className="mb-3 text-xs">
                  Enable or disable tiles and drag to reorder them.
                </CardDescription>
                <div className="space-y-3">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="tiles">
                      {(provided: DroppableProvided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2"
                        >
                          {preferences.enabledTiles.map((tile, index) => (
                            <Draggable
                              key={tile}
                              draggableId={tile}
                              index={index}
                            >
                              {(provided: DraggableProvided) => (
                                <TileRow
                                  tile={tile}
                                  index={index}
                                  isEnabled={true}
                                  preferences={preferences}
                                  toggleTile={toggleTile}
                                  updateTilePreference={updateTilePreference}
                                  provided={provided}
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {allTiles
                    .filter((tile) => !preferences.enabledTiles.includes(tile))
                    .map((tile) => (
                      <TileRow
                        key={`disabled-${tile}`}
                        tile={tile}
                        index={-1}
                        isEnabled={false}
                        preferences={preferences}
                        toggleTile={toggleTile}
                        updateTilePreference={updateTilePreference}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-3 mt-2">
            <Card>
              <CardContent className="pt-4 pb-3">
                <CardDescription className="mb-3 text-xs">
                  Change theme preferences.
                </CardDescription>
                <div className="space-y-3">
                  <ThemeOption
                    theme="light"
                    currentTheme={preferences.theme}
                    icon={Sun}
                    label="Light Theme"
                    iconColor="text-yellow-500"
                    onClick={() => updateTheme("light")}
                  />
                  <ThemeOption
                    theme="dark"
                    currentTheme={preferences.theme}
                    icon={Moon}
                    label="Dark Theme"
                    iconColor="text-blue-400"
                    onClick={() => updateTheme("dark")}
                  />
                  <ThemeOption
                    theme="system"
                    currentTheme={preferences.theme}
                    icon={Monitor}
                    label="System Theme"
                    iconColor="text-green-500"
                    onClick={() => updateTheme("system")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-3 mt-2">
            <Card>
              <CardContent className="pt-4 pb-3">
                <CardDescription className="mb-3 text-xs">
                  Configure tile behavior and refresh intervals.
                </CardDescription>
                <div className="space-y-3">
                  {preferences.enabledTiles.map((tile) => (
                    <div
                      key={`refresh-${tile}`}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md border"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{tileIcons[tile]}</span>
                        <span className="text-xs font-medium">
                          {tileNames[tile]}
                        </span>
                      </div>
                      <Select
                        value={
                          preferences.tilePreferences[tile].refreshInterval.toString()
                        }
                        onValueChange={(value) =>
                          updateTilePreference(
                            tile,
                            "refreshInterval",
                            parseInt(value)
                          )
                        }
                      >
                        <SelectTrigger className="w-[120px] h-7 text-xs">
                          <SelectValue placeholder="Refresh" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60" className="text-xs">Every 1 minute</SelectItem>
                          <SelectItem value="300" className="text-xs">Every 5 minutes</SelectItem>
                          <SelectItem value="600" className="text-xs">Every 10 minutes</SelectItem>
                          <SelectItem value="1800" className="text-xs">Every 30 minutes</SelectItem>
                          <SelectItem value="3600" className="text-xs">Every hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="h-8 text-xs"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

DashboardPreferences.displayName = 'DashboardPreferences';
