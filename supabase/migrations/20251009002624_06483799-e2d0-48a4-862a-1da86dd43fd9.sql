-- Add 'completed' value to patient_status enum
ALTER TYPE patient_status ADD VALUE IF NOT EXISTS 'completed';