-- Create the dashboard_preferences table
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  enabled_tiles TEXT[] NOT NULL,
  tile_order INTEGER[] NOT NULL,
  tile_preferences JSONB NOT NULL DEFAULT '{}',
  theme TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'system'))
);

-- Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON dashboard_preferences(user_id);

-- Set up Row Level Security (RLS)
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own preferences"
  ON dashboard_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON dashboard_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON dashboard_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON dashboard_preferences
  FOR DELETE
  USING (auth.uid() = user_id); 