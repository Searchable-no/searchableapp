export type TileType = 'email' | 'teams_message' | 'teams_channel' | 'calendar' | 'files' | 'planner'

export type ResourceType = 'sharepoint' | 'teams' | 'planner'

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_resources: {
        Row: {
          id: string
          workspace_id: string
          resource_type: ResourceType
          resource_id: string
          resource_name: string
          resource_url?: string
          bucket?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          resource_type: ResourceType
          resource_id: string
          resource_name: string
          resource_url?: string
          bucket?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          resource_type?: ResourceType
          resource_id?: string
          resource_name?: string
          resource_url?: string
          bucket?: string
          created_at?: string
          updated_at?: string
        }
      }
      emails: {
        Row: {
          id: string
          created_at: string
          subject: string
          from: string
          preview: string
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          subject: string
          from: string
          preview: string
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          subject?: string
          from?: string
          preview?: string
          user_id?: string
        }
      }
      dashboard_preferences: {
        Row: {
          id: string
          user_id: string
          enabled_tiles: TileType[]
          tile_order: number[]
          tile_preferences: Record<TileType, {
            size: 'compact' | 'normal' | 'large'
            refreshInterval: number
          }>
          theme: 'light' | 'dark' | 'system'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled_tiles?: TileType[]
          tile_order?: number[]
          tile_preferences?: Record<TileType, {
            size: 'compact' | 'normal' | 'large'
            refreshInterval: number
          }>
          theme?: 'light' | 'dark' | 'system'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled_tiles?: TileType[]
          tile_order?: number[]
          tile_preferences?: Record<TileType, {
            size: 'compact' | 'normal' | 'large'
            refreshInterval: number
          }>
          theme?: 'light' | 'dark' | 'system'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 