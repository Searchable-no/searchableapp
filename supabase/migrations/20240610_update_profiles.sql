-- Add is_placeholder column to profiles table
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false; 