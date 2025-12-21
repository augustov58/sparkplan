-- Add service conductor parameters to short_circuit_calculations table
-- These fields capture the distance and conductor characteristics from utility transformer to service panel

ALTER TABLE public.short_circuit_calculations
ADD COLUMN service_conductor_length NUMERIC,
ADD COLUMN service_conductor_size TEXT,
ADD COLUMN service_conductor_material TEXT CHECK (service_conductor_material IN ('Cu', 'Al')),
ADD COLUMN service_conduit_type TEXT CHECK (service_conduit_type IN ('Steel', 'PVC', 'Aluminum'));

-- Add helpful comment
COMMENT ON COLUMN public.short_circuit_calculations.service_conductor_length IS 'Distance in feet from utility transformer to service panel (Service mode only)';
COMMENT ON COLUMN public.short_circuit_calculations.service_conductor_size IS 'Service conductor size, e.g., "3/0 AWG" (Service mode only)';
COMMENT ON COLUMN public.short_circuit_calculations.service_conductor_material IS 'Conductor material: Cu or Al (Service mode only)';
COMMENT ON COLUMN public.short_circuit_calculations.service_conduit_type IS 'Conduit type for service conductors (Service mode only)';
