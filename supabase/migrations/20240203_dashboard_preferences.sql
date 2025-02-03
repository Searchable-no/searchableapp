-- Create an enum for tile types
CREATE TYPE tile_type AS ENUM (
  'email',
  'teams_message',
  'teams_channel',
  'calendar',
  'files'
);

-- Create the dashboard_preferences table
CREATE TABLE dashboard_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled_tiles tile_type[] NOT NULL DEFAULT ARRAY['email', 'teams_message', 'teams_channel', 'calendar', 'files']::tile_type[],
  tile_order INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4], -- Maps to the index in enabled_tiles
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboard_preferences_updated_at
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 