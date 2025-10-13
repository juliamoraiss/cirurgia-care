-- Update paid_traffic_reports table to match the actual lead report structure
ALTER TABLE paid_traffic_reports 
  DROP COLUMN IF EXISTS investment,
  DROP COLUMN IF EXISTS impressions,
  DROP COLUMN IF EXISTS clicks,
  DROP COLUMN IF EXISTS conversions,
  DROP COLUMN IF EXISTS cpc,
  DROP COLUMN IF EXISTS cpa,
  DROP COLUMN IF EXISTS roi;

ALTER TABLE paid_traffic_reports
  ADD COLUMN total_leads integer,
  ADD COLUMN scheduled_appointments integer,
  ADD COLUMN not_scheduled integer,
  ADD COLUMN awaiting_response integer,
  ADD COLUMN no_continuity integer,
  ADD COLUMN no_contact_after_attempts integer,
  ADD COLUMN leads_outside_brasilia integer,
  ADD COLUMN active_leads integer,
  ADD COLUMN in_progress integer,
  ADD COLUMN period_start date,
  ADD COLUMN period_end date,
  ADD COLUMN concierge_name text;