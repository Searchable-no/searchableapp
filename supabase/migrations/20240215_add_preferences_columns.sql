-- Add new columns to dashboard_preferences table
ALTER TABLE dashboard_preferences
ADD COLUMN IF NOT EXISTS tile_preferences JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';

-- Add constraint for theme values
ALTER TABLE dashboard_preferences
ADD CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'system'));

-- Update existing rows with default values
UPDATE dashboard_preferences
SET 
  tile_preferences = jsonb_build_object(
    'email', jsonb_build_object('size', 'normal', 'refreshInterval', 300),
    'teams_message', jsonb_build_object('size', 'normal', 'refreshInterval', 300),
    'teams_channel', jsonb_build_object('size', 'normal', 'refreshInterval', 300),
    'calendar', jsonb_build_object('size', 'normal', 'refreshInterval', 300),
    'files', jsonb_build_object('size', 'normal', 'refreshInterval', 300),
    'planner', jsonb_build_object('size', 'normal', 'refreshInterval', 300)
  ),
  theme = 'system'
WHERE tile_preferences IS NULL OR theme IS NULL; 