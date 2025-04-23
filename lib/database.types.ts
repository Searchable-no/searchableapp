export type TileType = 'email' | 'teams_message' | 'teams_channel' | 'calendar' | 'files' | 'planner'

export type ResourceType = 'sharepoint' | 'teams' | 'planner'

// New project-related types
export type ProjectColumnType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'user' | 'team' | 'boolean'

// Nye organisasjonsrelaterte typer
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'guest'

export interface Database {
  public: {
    Tables: {
      // Nye organisasjonstabeller
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          ms_tenant_id?: string
          settings: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          ms_tenant_id?: string
          settings?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          ms_tenant_id?: string
          settings?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: OrganizationRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: OrganizationRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: OrganizationRole
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          user_id: string
          organization_id?: string // Oppdatert
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          organization_id?: string // Oppdatert
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          organization_id?: string // Oppdatert
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
      // New tables for premium project functionality
      projects: {
        Row: {
          id: string
          name: string
          description: string
          workspace_id: string
          sharepoint_site_id?: string
          team_id?: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          workspace_id: string
          sharepoint_site_id?: string
          team_id?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          workspace_id?: string
          sharepoint_site_id?: string
          team_id?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_columns: {
        Row: {
          id: string
          project_id: string
          name: string
          type: ProjectColumnType
          required: boolean
          options?: string[] // For select/multiselect types
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type: ProjectColumnType
          required: boolean
          options?: string[]
          order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: ProjectColumnType
          required?: boolean
          options?: string[]
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      project_items: {
        Row: {
          id: string
          project_id: string
          values: Record<string, unknown> // Maps column ID to value
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          values: Record<string, unknown>
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          values?: Record<string, unknown>
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 