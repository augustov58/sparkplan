-- Add load_type column to circuits table for NEC Article 220 demand factor calculations
-- Load types: L=Lighting, M=Motor, R=Receptacles, O=Other, H=Heating, C=Cooling, W=Water Heater, D=Dryer, K=Kitchen

ALTER TABLE circuits 
ADD COLUMN IF NOT EXISTS load_type VARCHAR(1) CHECK (load_type IN ('L', 'M', 'R', 'O', 'H', 'C', 'W', 'D', 'K'));

-- Set default load type based on description patterns (optional automatic classification)
UPDATE circuits SET load_type = 'L' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%light%' OR 
  LOWER(description) LIKE '%lighting%' OR
  LOWER(description) LIKE '%lamp%'
);

UPDATE circuits SET load_type = 'R' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%receptacle%' OR 
  LOWER(description) LIKE '%outlet%' OR
  LOWER(description) LIKE '%plug%'
);

UPDATE circuits SET load_type = 'M' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%motor%' OR 
  LOWER(description) LIKE '%pump%' OR
  LOWER(description) LIKE '%compressor%' OR
  LOWER(description) LIKE '%fan%' OR
  LOWER(description) LIKE '%blower%'
);

UPDATE circuits SET load_type = 'H' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%heat%' OR 
  LOWER(description) LIKE '%furnace%' OR
  LOWER(description) LIKE '%baseboard%'
);

UPDATE circuits SET load_type = 'C' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%a/c%' OR 
  LOWER(description) LIKE '%ac%' OR
  LOWER(description) LIKE '%air condition%' OR
  LOWER(description) LIKE '%cooling%' OR
  LOWER(description) LIKE '%hvac%'
);

UPDATE circuits SET load_type = 'W' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%water heater%' OR
  LOWER(description) LIKE '%hot water%'
);

UPDATE circuits SET load_type = 'D' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%dryer%'
);

UPDATE circuits SET load_type = 'K' WHERE load_type IS NULL AND (
  LOWER(description) LIKE '%range%' OR
  LOWER(description) LIKE '%oven%' OR
  LOWER(description) LIKE '%cooktop%' OR
  LOWER(description) LIKE '%kitchen%' OR
  LOWER(description) LIKE '%dishwasher%' OR
  LOWER(description) LIKE '%garbage disposal%'
);

-- Default remaining to 'O' (Other)
UPDATE circuits SET load_type = 'O' WHERE load_type IS NULL;

COMMENT ON COLUMN circuits.load_type IS 'NEC Article 220 load type classification: L=Lighting, M=Motor, R=Receptacles, O=Other, H=Heating, C=Cooling, W=Water Heater, D=Dryer, K=Kitchen';

