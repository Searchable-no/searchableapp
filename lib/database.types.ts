export type TileType = 'email' | 'teams_message' | 'teams_channel' | 'calendar' | 'files' | 'planner'

export interface Database {
  public: {
    Tables: {
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