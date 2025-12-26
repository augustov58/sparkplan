# Implementation Plan: Top 3 Priority Features

**Date:** December 1, 2025
**Project:** NEC Pro Compliance
**Status:** Ready for Implementation

---

## Overview

This document provides complete technical specifications for implementing the top 3 priority features identified by the electrical-engineering-advisor:

1. **Feeder Sizing Calculator** (16-20 hours)
2. **Equipment Grounding Conductor (EGC) Sizing** (8-10 hours)
3. **Panel Schedule PDF Export** (12-16 hours)

**Total Estimated Time:** 36-46 hours (1-1.5 weeks for single developer)

---

## Feature 1: Feeder Sizing Calculator (NEC Article 215)

### Overview

**Business Value:** Unlocks multi-panel design - currently the biggest blocker for professional use

**What It Does:**
- Calculates conductor size from source panel → destination panel/transformer
- Auto-calculates load from all circuits in destination panel
- Applies NEC 215.2 requirements (125% continuous + 100% non-continuous)
- Applies demand factors per NEC 220.61 for neutral conductor
- Outputs: Phase conductor size, neutral size, EGC size, conduit size, voltage drop percentage

**NEC Code Sections:**
- NEC 215.2: Minimum ampacity and size (125% continuous)
- NEC 215.2(A)(1): Continuous and noncontinuous loads
- NEC 220.61: Neutral conductor sizing with demand factors
- NEC 250.122: Equipment grounding conductor sizing
- NEC 240.6(A): Standard overcurrent device ratings
- NEC 310.15(B)(1): Temperature correction factors
- NEC 310.15(C)(1): Bundling adjustment factors
- Chapter 9, Table 9: AC impedance values (for voltage drop)

---

### 1.1 Database Schema

**New Table: `feeders`**

Create migration file: `/supabase/migration-feeders.sql`

```sql
CREATE TABLE feeders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_panel_id uuid REFERENCES panels(id) ON DELETE SET NULL,
  destination_panel_id uuid REFERENCES panels(id) ON DELETE SET NULL,
  destination_transformer_id uuid REFERENCES transformers(id) ON DELETE SET NULL,
  distance_ft numeric NOT NULL,
  conductor_material text NOT NULL CHECK (conductor_material IN ('Cu', 'Al')),
  conduit_type text,
  ambient_temperature_c integer DEFAULT 30,
  num_current_carrying integer DEFAULT 3,

  -- Calculated results (cached for display)
  total_load_va numeric,
  continuous_load_va numeric,
  noncontinuous_load_va numeric,
  design_load_va numeric,
  phase_conductor_size text,
  neutral_conductor_size text,
  egc_size text,
  conduit_size text,
  voltage_drop_percent numeric,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feeders"
  ON feeders FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own feeders"
  ON feeders FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own feeders"
  ON feeders FOR UPDATE
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own feeders"
  ON feeders FOR DELETE
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX idx_feeders_project_id ON feeders(project_id);
CREATE INDEX idx_feeders_source_panel ON feeders(source_panel_id);
CREATE INDEX idx_feeders_destination_panel ON feeders(destination_panel_id);

-- Link panels to their supplying feeder
ALTER TABLE panels ADD COLUMN IF NOT EXISTS supplied_by_feeder_id uuid REFERENCES feeders(id) ON DELETE SET NULL;
```

---

### 1.2 TypeScript Types

Create file: `/types/feeder.ts`

```typescript
export interface Feeder {
  id: string;
  project_id: string;
  name: string;
  source_panel_id: string | null;
  destination_panel_id: string | null;
  destination_transformer_id: string | null;
  distance_ft: number;
  conductor_material: 'Cu' | 'Al';
  conduit_type?: string;
  ambient_temperature_c: number;
  num_current_carrying: number;

  // Calculated results
  total_load_va?: number;
  continuous_load_va?: number;
  noncontinuous_load_va?: number;
  design_load_va?: number;
  phase_conductor_size?: string;
  neutral_conductor_size?: string;
  egc_size?: string;
  conduit_size?: string;
  voltage_drop_percent?: number;

  created_at?: string;
  updated_at?: string;
}

export interface FeederCalculationInput {
  source_voltage: number;
  source_phase: number;
  destination_voltage: number;
  destination_phase: number;
  total_load_va: number;
  continuous_load_va: number;
  noncontinuous_load_va: number;
  distance_ft: number;
  conductor_material: 'Cu' | 'Al';
  ambient_temperature_c: number;
  num_current_carrying: number;
  max_voltage_drop_percent?: number;
}

export interface FeederCalculationResult {
  design_load_va: number;
  design_current_amps: number;
  phase_conductor_size: string;
  phase_conductor_ampacity: number;
  neutral_conductor_size: string;
  egc_size: string;
  recommended_conduit_size: string;
  voltage_drop_percent: number;
  voltage_drop_volts: number;
  meets_voltage_drop: boolean;
  warnings: string[];
  necReferences: string[];
}
```

---

### 1.3 NEC Reference Data

Create file: `/data/nec/table-250-122.ts`

```typescript
/**
 * NEC Table 250.122 - Minimum Size Equipment Grounding Conductors
 * Based on overcurrent device rating
 */
export const TABLE_250_122 = [
  { maxOCPD: 15, copperAWG: '14', aluminumAWG: '12' },
  { maxOCPD: 20, copperAWG: '12', aluminumAWG: '10' },
  { maxOCPD: 60, copperAWG: '10', aluminumAWG: '8' },
  { maxOCPD: 100, copperAWG: '8', aluminumAWG: '6' },
  { maxOCPD: 200, copperAWG: '6', aluminumAWG: '4' },
  { maxOCPD: 300, copperAWG: '4', aluminumAWG: '2' },
  { maxOCPD: 400, copperAWG: '3', aluminumAWG: '1' },
  { maxOCPD: 500, copperAWG: '2', aluminumAWG: '1/0' },
  { maxOCPD: 600, copperAWG: '1', aluminumAWG: '2/0' },
  { maxOCPD: 800, copperAWG: '1/0', aluminumAWG: '3/0' },
  { maxOCPD: 1000, copperAWG: '2/0', aluminumAWG: '4/0' },
  { maxOCPD: 1200, copperAWG: '3/0', aluminumAWG: '250' },
  { maxOCPD: 1600, copperAWG: '4/0', aluminumAWG: '350' },
  { maxOCPD: 2000, copperAWG: '250', aluminumAWG: '400' },
  { maxOCPD: 2500, copperAWG: '350', aluminumAWG: '600' },
  { maxOCPD: 3000, copperAWG: '400', aluminumAWG: '600' },
  { maxOCPD: 4000, copperAWG: '500', aluminumAWG: '750' },
  { maxOCPD: 5000, copperAWG: '700', aluminumAWG: '1200' },
  { maxOCPD: 6000, copperAWG: '800', aluminumAWG: '1200' }
] as const;

export function getEGCSize(
  breakerRating: number,
  material: 'Cu' | 'Al'
): string {
  const row = TABLE_250_122.find(r => breakerRating <= r.maxOCPD);
  if (!row) {
    return material === 'Cu' ? '800' : '1200';
  }
  return material === 'Cu' ? row.copperAWG : row.aluminumAWG;
}
```

Update file: `/data/nec/index.ts`

```typescript
export * from './table-250-122';
```

---

### 1.4 Feeder Calculation Service

Create file: `/services/calculations/feederSizing.ts`

```typescript
import { sizeConductor } from './conductorSizing';
import { calculateVoltageDropAC } from './voltageDrop';
import { getEGCSize } from '@/data/nec/table-250-122';
import { getNextStandardBreakerSize } from '@/data/nec/standard-breakers';
import type { FeederCalculationInput, FeederCalculationResult } from '@/types/feeder';

/**
 * Calculate feeder conductor sizing per NEC Article 215
 *
 * NEC 215.2: Feeder conductors shall have ampacity not less than the loads served
 * NEC 215.2(A)(1): Continuous loads at 125% + noncontinuous loads at 100%
 */
export function calculateFeederSizing(
  input: FeederCalculationInput
): FeederCalculationResult {
  const warnings: string[] = [];
  const necReferences: string[] = [
    'NEC 215.2 - Feeder Conductor Ampacity',
    'NEC 215.2(A)(1) - 125% Continuous + 100% Noncontinuous Loads'
  ];

  // Step 1: Calculate design load per NEC 215.2(A)(1)
  const design_load_va = (input.continuous_load_va * 1.25) + input.noncontinuous_load_va;

  // Step 2: Calculate design current
  let design_current_amps: number;
  if (input.source_phase === 1) {
    design_current_amps = design_load_va / input.source_voltage;
  } else {
    design_current_amps = design_load_va / (Math.sqrt(3) * input.source_voltage);
  }

  // Step 3: Size phase conductors
  const phaseConductor = sizeConductor(
    design_current_amps,
    {
      serviceVoltage: input.source_voltage,
      servicePhase: input.source_phase,
      conductorMaterial: input.conductor_material,
      temperatureRating: 75
    },
    input.ambient_temperature_c,
    input.num_current_carrying,
    false // Continuous already factored in design_load_va
  );

  necReferences.push(...phaseConductor.necReferences);

  // Step 4: Calculate voltage drop
  const vdResult = calculateVoltageDropAC(
    phaseConductor.conductorSize,
    input.conductor_material,
    'PVC',
    input.distance_ft,
    design_current_amps,
    input.source_voltage,
    input.source_phase
  );

  const max_vd = input.max_voltage_drop_percent || 3.0;
  const meets_vd = vdResult.voltageDropPercent <= max_vd;

  if (!meets_vd) {
    warnings.push(
      `⚠️ Voltage drop ${vdResult.voltageDropPercent.toFixed(2)}% exceeds ${max_vd}% limit (NEC 210.19 FPN). Consider upsizing conductor.`
    );
  }

  necReferences.push('NEC 210.19 - Voltage Drop Recommendation (3% max)');

  // Step 5: Size neutral conductor per NEC 220.61
  // Simplified: Use same size as phase conductor
  // TODO: Implement full NEC 220.61 demand factor calculations
  const neutral_conductor_size = phaseConductor.conductorSize;
  necReferences.push('NEC 220.61 - Feeder Neutral Load');

  // Step 6: Size EGC per NEC 250.122
  const breaker_size = getNextStandardBreakerSize(design_current_amps);
  const egc_size = getEGCSize(breaker_size, input.conductor_material);
  necReferences.push('NEC 250.122 - Equipment Grounding Conductor Sizing');

  // Step 7: Calculate conduit size (simplified)
  const num_conductors = input.source_phase === 3 ? 4 : 3;
  const conduit_size = estimateConduitSize(phaseConductor.conductorSize, num_conductors);
  necReferences.push('NEC Chapter 9, Table 4 - Conduit Fill');

  return {
    design_load_va,
    design_current_amps: Math.round(design_current_amps * 10) / 10,
    phase_conductor_size: phaseConductor.conductorSize,
    phase_conductor_ampacity: phaseConductor.adjustedAmpacity,
    neutral_conductor_size,
    egc_size,
    recommended_conduit_size: conduit_size,
    voltage_drop_percent: vdResult.voltageDropPercent,
    voltage_drop_volts: vdResult.voltageDropVolts,
    meets_voltage_drop: meets_vd,
    warnings,
    necReferences
  };
}

/**
 * Simplified conduit sizing (conservative estimate)
 */
function estimateConduitSize(conductorSize: string, numConductors: number): string {
  // Very simplified - should use proper conduit fill calculations
  const sizeMap: Record<string, string> = {
    '14': '1/2"',
    '12': '1/2"',
    '10': '3/4"',
    '8': '3/4"',
    '6': '1"',
    '4': '1-1/4"',
    '3': '1-1/4"',
    '2': '1-1/2"',
    '1': '1-1/2"',
    '1/0': '2"',
    '2/0': '2"',
    '3/0': '2-1/2"',
    '4/0': '3"'
  };

  return sizeMap[conductorSize] || '3"';
}
```

Add export to `/services/calculations/index.ts`:
```typescript
export * from './feederSizing';
```

---

### 1.5 Custom Hook

Create file: `/hooks/useFeeders.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Feeder } from '@/types/feeder';

export function useFeeders(projectId: string | undefined) {
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeders = async () => {
    if (!projectId) {
      setFeeders([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('feeders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFeeders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feeders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeders();

    if (!projectId) return;

    const subscription = supabase
      .channel(`feeders_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feeders',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchFeeders();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const createFeeder = async (feeder: Omit<Feeder, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('feeders')
        .insert([feeder])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feeder');
      throw err;
    }
  };

  const updateFeeder = async (id: string, updates: Partial<Feeder>) => {
    try {
      const { data, error } = await supabase
        .from('feeders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feeder');
      throw err;
    }
  };

  const deleteFeeder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feeders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feeder');
      throw err;
    }
  };

  return { feeders, loading, error, createFeeder, updateFeeder, deleteFeeder };
}
```

---

### 1.6 Implementation Steps

| # | Task | Complexity | Est. Time |
|---|------|------------|-----------|
| 1 | Create `/types/feeder.ts` with TypeScript types | Simple | 30 min |
| 2 | Create NEC Table 250.122 data (`/data/nec/table-250-122.ts`) | Simple | 30 min |
| 3 | Create database migration (`/supabase/migration-feeders.sql`) | Medium | 1 hour |
| 4 | Run migration in Supabase SQL Editor | Simple | 10 min |
| 5 | Create `/services/calculations/feederSizing.ts` | Complex | 4-5 hours |
| 6 | Create `/hooks/useFeeders.ts` custom hook | Medium | 2 hours |
| 7 | Create `/components/FeederSizingTool.tsx` component | Complex | 5-6 hours |
| 8 | Add route to `App.tsx` | Simple | 15 min |
| 9 | Add navigation link to `Layout.tsx` | Simple | 15 min |
| 10 | Update `/lib/database.types.ts` (regenerate from Supabase) | Simple | 10 min |
| 11 | Add unit tests to `/tests/calculations.test.ts` | Medium | 2-3 hours |

**Total: 16-20 hours**

---

### 1.7 Unit Tests

Add to `/tests/calculations.test.ts`:

```typescript
describe('Feeder Sizing Calculations', () => {
  test('calculates 3-phase feeder with 125% continuous load factor', () => {
    const input: FeederCalculationInput = {
      source_voltage: 480,
      source_phase: 3,
      destination_voltage: 480,
      destination_phase: 3,
      total_load_va: 50000,
      continuous_load_va: 30000,
      noncontinuous_load_va: 20000,
      distance_ft: 150,
      conductor_material: 'Cu',
      ambient_temperature_c: 30,
      num_current_carrying: 3
    };

    const result = calculateFeederSizing(input);

    // Design load = 30kVA * 1.25 + 20kVA = 57.5 kVA
    expect(result.design_load_va).toBeCloseTo(57500, 0);

    // Design current = 57500 / (sqrt(3) * 480) = 69.2A
    expect(result.design_current_amps).toBeCloseTo(69.2, 1);

    expect(result.phase_conductor_size).toBeDefined();
    expect(result.egc_size).toBeDefined();
    expect(result.voltage_drop_percent).toBeLessThan(5);
  });

  test('sizes EGC per NEC Table 250.122', () => {
    expect(getEGCSize(100, 'Cu')).toBe('8');
    expect(getEGCSize(200, 'Cu')).toBe('6');
    expect(getEGCSize(100, 'Al')).toBe('6');
  });
});
```

---

## Feature 2: Equipment Grounding Conductor (EGC) Sizing

### Overview

**Business Value:** Required for code compliance - every circuit and feeder needs this

**What It Does:**
- Automatically calculates EGC size based on breaker rating per NEC Table 250.122
- Handles proportional upsizing when phase conductors increased for voltage drop
- Integrates with conductor sizing, circuit creation, and feeder calculations

**NEC Code Sections:**
- NEC 250.122: Minimum size equipment grounding conductors
- NEC 250.122(B): Proportional increase when phase conductors upsized
- NEC Table 250.122: Sizing based on OCPD rating

---

### 2.1 Database Schema

Run migration: `/supabase/migration-egc-sizing.sql`

```sql
ALTER TABLE circuits ADD COLUMN IF NOT EXISTS egc_size text;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS service_egc_size text;
```

---

### 2.2 Conductor Properties Data

Create file: `/data/nec/conductor-properties.ts`

```typescript
/**
 * Circular mil areas for standard conductor sizes
 * Used for proportional EGC sizing per NEC 250.122(B)
 */
export const AWG_CIRCULAR_MILS: Record<string, number> = {
  '18': 1620,
  '16': 2580,
  '14': 4110,
  '12': 6530,
  '10': 10380,
  '8': 16510,
  '6': 26240,
  '4': 41740,
  '3': 52620,
  '2': 66360,
  '1': 83690,
  '1/0': 105600,
  '2/0': 133100,
  '3/0': 167800,
  '4/0': 211600,
  '250': 250000,
  '300': 300000,
  '350': 350000,
  '400': 400000,
  '500': 500000,
  '600': 600000,
  '700': 700000,
  '750': 750000,
  '800': 800000,
  '900': 900000,
  '1000': 1000000,
  '1250': 1250000,
  '1500': 1500000,
  '1750': 1750000,
  '2000': 2000000
};
```

---

### 2.3 EGC Sizing Service

Create file: `/services/calculations/egcSizing.ts`

```typescript
import { TABLE_250_122 } from '@/data/nec/table-250-122';
import { AWG_CIRCULAR_MILS } from '@/data/nec/conductor-properties';

export interface EGCSizingInput {
  breaker_rating: number;
  conductor_material: 'Cu' | 'Al';
  phase_conductor_size?: string;
  phase_conductor_upsized?: boolean;
  original_phase_size?: string;
}

export interface EGCSizingResult {
  egc_size: string;
  is_upsized: boolean;
  notes: string[];
}

/**
 * Calculate proportionally upsized EGC per NEC 250.122(B)
 */
export function calculateProportionalEGC(
  baseEGCSize: string,
  originalPhaseSize: string,
  upsizedPhaseSize: string
): string {
  const baseEGC_CM = AWG_CIRCULAR_MILS[baseEGCSize];
  const originalPhase_CM = AWG_CIRCULAR_MILS[originalPhaseSize];
  const upsizedPhase_CM = AWG_CIRCULAR_MILS[upsizedPhaseSize];

  if (!baseEGC_CM || !originalPhase_CM || !upsizedPhase_CM) {
    return baseEGCSize;
  }

  const requiredEGC_CM = baseEGC_CM * (upsizedPhase_CM / originalPhase_CM);

  const sizes = Object.entries(AWG_CIRCULAR_MILS)
    .sort((a, b) => a[1] - b[1]);

  const nextSize = sizes.find(([_, cm]) => cm >= requiredEGC_CM);
  return nextSize ? nextSize[0] : baseEGCSize;
}

/**
 * Main EGC sizing function
 */
export function sizeEGC(input: EGCSizingInput): EGCSizingResult {
  const notes: string[] = [];

  const row = TABLE_250_122.find(r => input.breaker_rating <= r.maxOCPD);
  const baseEGCSize = row
    ? (input.conductor_material === 'Cu' ? row.copperAWG : row.aluminumAWG)
    : (input.conductor_material === 'Cu' ? '800' : '1200');

  notes.push(`Base EGC from NEC Table 250.122: ${baseEGCSize} AWG ${input.conductor_material}`);

  let finalEGCSize = baseEGCSize;
  let isUpsized = false;

  if (input.phase_conductor_upsized && input.phase_conductor_size && input.original_phase_size) {
    finalEGCSize = calculateProportionalEGC(
      baseEGCSize,
      input.original_phase_size,
      input.phase_conductor_size
    );

    if (finalEGCSize !== baseEGCSize) {
      isUpsized = true;
      notes.push(`EGC upsized per NEC 250.122(B): Phase increased from ${input.original_phase_size} to ${input.phase_conductor_size}`);
    }
  }

  return {
    egc_size: finalEGCSize,
    is_upsized: isUpsized,
    notes
  };
}
```

---

### 2.4 Implementation Steps

| # | Task | Complexity | Est. Time |
|---|------|------------|-----------|
| 1 | Create `/data/nec/conductor-properties.ts` | Simple | 30 min |
| 2 | Create `/services/calculations/egcSizing.ts` | Medium | 2 hours |
| 3 | Run database migration | Simple | 5 min |
| 4 | Update `conductorSizing.ts` to include EGC | Medium | 1 hour |
| 5 | Update `ConductorSizingTool.tsx` to display EGC | Simple | 30 min |
| 6 | Update circuit creation forms | Medium | 1 hour |
| 7 | Add EGC column to `PanelSchedule.tsx` | Simple | 30 min |
| 8 | Update `FeederSizingTool.tsx` if Feature 1 done | Simple | 30 min |
| 9 | Add unit tests | Medium | 2 hours |
| 10 | Update types in `/types.ts` | Simple | 15 min |

**Total: 8-10 hours**

---

## Feature 3: Panel Schedule PDF Export

### Overview

**Business Value:** Required for permit submittal - saves 2-4 hours per project

**What It Does:**
- Exports professional panel schedules as PDF
- Industry-standard format (Square D / Siemens style)
- Single panel or multi-panel export
- Includes circuit table, phase balancing, panel identification

**PDF Contents:**
- Panel identification (name, location, voltage, phase, bus rating, main breaker)
- Circuit-by-circuit table (circuit #, breaker, poles, wire, EGC, description, load VA)
- Phase balancing summary (VA and amps per phase)
- Date prepared, NEC compliance footer

---

### 3.1 Implementation

Create file: `/services/pdfExport/panelSchedulePDF.tsx`

*Full implementation code available in AGENT_REPORTS.md (too long to include here)*

Key features:
- Uses `@react-pdf/renderer` (already installed)
- Professional styling matching industry standards
- Handles both single-panel and multi-panel exports
- Calculates phase totals and current per phase
- Black & white friendly for printing

---

### 3.2 Implementation Steps

| # | Task | Complexity | Est. Time |
|---|------|------------|-----------|
| 1 | Verify `@react-pdf/renderer` installed | Simple | 5 min |
| 2 | Create `/services/pdfExport/panelSchedulePDF.tsx` | Complex | 6-8 hours |
| 3 | Add "Export PDF" button to `PanelSchedule.tsx` | Simple | 30 min |
| 4 | Test single panel export | Medium | 1 hour |
| 5 | Implement multi-panel PDF function | Medium | 2 hours |
| 6 | Add "Export All" button to Dashboard | Simple | 30 min |
| 7 | Test multi-panel export | Medium | 1 hour |
| 8 | Add project address field to `ProjectSetup.tsx` | Simple | 30 min |
| 9 | Style PDF to match industry standards | Medium | 1-2 hours |
| 10 | Add page breaks for multi-panel | Medium | 1 hour |

**Total: 12-16 hours**

---

## Testing Strategy

### Unit Tests
- Load calculation with demand factors
- Conductor sizing with corrections
- EGC sizing from Table 250.122
- EGC proportional upsizing
- Feeder calculations
- Breaker sizing

**Goal:** >90% code coverage for calculation services

### Manual Testing
- Create sample projects with multiple panels
- Test feeder calculations with various configurations
- Verify EGC sizes match NEC Table 250.122
- Export PDF and verify formatting
- Test in Chrome, Firefox, Safari
- Print PDF to verify black & white rendering

---

## Implementation Order

**Week 1:**
1. **Days 1-2:** Feature 2 (EGC Sizing) - Foundation
2. **Days 3-5:** Feature 1 (Feeder Sizing) - Builds on EGC

**Week 2:**
3. **Days 1-3:** Feature 3 (Panel Schedule PDF) - Final deliverable

**Rationale:**
- EGC sizing is needed by both feeders and panel schedules
- Feeder sizing is most complex but reuses existing services
- PDF export showcases completed work

---

## Success Criteria

✅ All three features pass NEC compliance validation
✅ Unit tests achieve >90% code coverage
✅ Manual testing confirms professional-grade output
✅ No breaking changes to existing projects
✅ Performance <2s for any calculation
✅ PDF exports match industry-standard formats

---

## Next Steps

1. Review this plan with team
2. Create GitHub issues for each feature
3. Set up test environment with sample data
4. Begin Feature 2 implementation
5. Conduct code reviews after each component
6. Validate against NEC Handbook before marking complete

---

*For complete agent transcripts and additional context, see `AGENT_REPORTS.md`*
