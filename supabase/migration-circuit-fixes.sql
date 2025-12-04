-- ============================================================================
-- MIGRATION: Circuit Fixes
-- Date: 2025-12-02
-- Purpose: Fix circuit display issues by adding unique constraint
-- ============================================================================

-- STEP 1: IDENTIFY AND FIX DUPLICATE CIRCUIT NUMBERS
-- ============================================================================
--
-- First, let's find and fix any duplicate circuit numbers that exist
-- We'll renumber duplicates to be sequential

DO $$
DECLARE
    panel_record RECORD;
    circuit_record RECORD;
    next_available_number INTEGER;
BEGIN
    -- For each panel
    FOR panel_record IN
        SELECT id, name FROM public.panels
    LOOP
        -- Find duplicate circuit numbers in this panel
        FOR circuit_record IN
            SELECT circuit_number, COUNT(*) as count
            FROM public.circuits
            WHERE panel_id = panel_record.id
            GROUP BY circuit_number
            HAVING COUNT(*) > 1
            ORDER BY circuit_number
        LOOP
            RAISE NOTICE 'Panel %: Found % circuits with number %',
                panel_record.name, circuit_record.count, circuit_record.circuit_number;

            -- Keep the first circuit, renumber the rest
            WITH duplicates AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
                FROM public.circuits
                WHERE panel_id = panel_record.id
                  AND circuit_number = circuit_record.circuit_number
            )
            UPDATE public.circuits c
            SET circuit_number = (
                SELECT COALESCE(MAX(circuit_number), 0) + d.rn
                FROM public.circuits
                WHERE panel_id = panel_record.id
                  AND circuit_number NOT IN (
                      SELECT circuit_number FROM duplicates WHERE rn > 1
                  )
            )
            FROM duplicates d
            WHERE c.id = d.id AND d.rn > 1;
        END LOOP;
    END LOOP;
END $$;

-- STEP 2: ADD UNIQUE CONSTRAINT
-- ============================================================================
--
-- Prevent duplicate circuit numbers in the same panel

-- Drop constraint if it exists (in case this is being re-run)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'circuits_panel_circuit_number_unique'
    ) THEN
        ALTER TABLE public.circuits DROP CONSTRAINT circuits_panel_circuit_number_unique;
    END IF;
END $$;

-- Add unique constraint on (panel_id, circuit_number)
ALTER TABLE public.circuits
ADD CONSTRAINT circuits_panel_circuit_number_unique
UNIQUE (panel_id, circuit_number);

-- STEP 3: ADD HELPFUL INDEX
-- ============================================================================
--
-- This index helps with ordering and lookups

-- Drop index if it exists
DROP INDEX IF EXISTS idx_circuits_panel_circuit_number;

-- Create index on (panel_id, circuit_number) for fast lookups
CREATE INDEX idx_circuits_panel_circuit_number
ON public.circuits(panel_id, circuit_number);

-- STEP 4: ADD EGC SIZE COLUMN (IF NOT EXISTS)
-- ============================================================================
--
-- Add Equipment Grounding Conductor size column if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'circuits'
        AND column_name = 'egc_size'
    ) THEN
        ALTER TABLE public.circuits
        ADD COLUMN egc_size TEXT;

        -- Set default EGC size based on breaker amps
        UPDATE public.circuits
        SET egc_size = CASE
            WHEN breaker_amps <= 15 THEN '14 AWG'
            WHEN breaker_amps <= 20 THEN '12 AWG'
            WHEN breaker_amps <= 30 THEN '10 AWG'
            WHEN breaker_amps <= 40 THEN '10 AWG'
            WHEN breaker_amps <= 60 THEN '10 AWG'
            WHEN breaker_amps <= 100 THEN '8 AWG'
            WHEN breaker_amps <= 200 THEN '6 AWG'
            ELSE '4 AWG'
        END
        WHERE egc_size IS NULL;

        RAISE NOTICE 'Added egc_size column and set default values';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the migration worked correctly:

-- Check for any remaining duplicates (should return 0 rows)
-- SELECT panel_id, circuit_number, COUNT(*)
-- FROM public.circuits
-- GROUP BY panel_id, circuit_number
-- HAVING COUNT(*) > 1;

-- Verify unique constraint exists
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.circuits'::regclass
-- AND conname = 'circuits_panel_circuit_number_unique';
