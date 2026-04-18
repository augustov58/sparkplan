-- Add source tracking to jurisdictions table
-- This tracks where the requirement data came from (official AHJ website, ICC database, etc.)

ALTER TABLE jurisdictions
ADD COLUMN IF NOT EXISTS data_source TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS last_verified_date DATE;

-- Add comments
COMMENT ON COLUMN jurisdictions.data_source IS 'Source of jurisdiction data (e.g., "Official AHJ Website", "ICC Code Adoption Map", "Contractor Feedback")';
COMMENT ON COLUMN jurisdictions.source_url IS 'URL to official source document or permit requirements page';
COMMENT ON COLUMN jurisdictions.last_verified_date IS 'Date when requirements were last verified as accurate';

-- Update existing jurisdictions with source information
UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://www.miamigov.com/building',
  last_verified_date = '2025-12-31'
WHERE city = 'Miami' AND state = 'FL';

UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://www.tampa.gov/building-construction',
  last_verified_date = '2025-12-31'
WHERE city = 'Tampa' AND state = 'FL';

UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://www.orlando.gov/building-development',
  last_verified_date = '2025-12-31'
WHERE city = 'Orlando' AND state = 'FL';

UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://www.houstontx.gov/developmentservices',
  last_verified_date = '2025-12-31'
WHERE city = 'Houston' AND state = 'TX';

UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://dallascityhall.com/departments/development-services',
  last_verified_date = '2025-12-31'
WHERE city = 'Dallas' AND state = 'TX';

UPDATE jurisdictions
SET
  data_source = 'Official AHJ Website',
  source_url = 'https://www.austintexas.gov/department/development-services',
  last_verified_date = '2025-12-31'
WHERE city = 'Austin' AND state = 'TX';
