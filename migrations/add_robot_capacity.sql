-- Migration: Add robot_capacity to event_robot table
-- Run this in Supabase SQL Editor

ALTER TABLE event_robot 
ADD COLUMN robot_capacity integer DEFAULT 50 CHECK (robot_capacity >= 1);

-- Update existing rows to have default capacity
UPDATE event_robot 
SET robot_capacity = 50 
WHERE robot_capacity IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN event_robot.robot_capacity IS 'Total drink capacity for this robot at this event (default: 50)';
